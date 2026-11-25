'use strict';

const byId = (id) => document.getElementById(id);

const tabs = [...document.querySelectorAll('[role=tab]')];
function showTab(tab) {
  for (const option of tabs) {
    const selected = tab === option;
    option.tabIndex = selected ? 0 : -1;
    option.setAttribute('aria-selected', selected);
    byId(option.getAttribute('aria-controls')).hidden = !selected;
  }
}
for (const [index, tab] of tabs.entries()) {
  tab.addEventListener('click', () => showTab(tab));
  tab.addEventListener('keydown', (event) => {
    const target = {Home: 0, End: tabs.length - 1, ArrowLeft: (index + tabs.length - 1) % tabs.length, ArrowRight: (index + 1) % tabs.length}[event.key];
    if (target === undefined) return;
    event.preventDefault();
    showTab(tabs[target]);
    tabs[target].focus();
  });
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function makeFlow(id, playbackId, stages, show) {
  const playback = createPlayback(playbackId, setLayer);
  const buttons = stages.map((name, layer) => {
    const button = element('button');
    button.type = 'button';
    const symbol = element('span', '', 'node-symbol');
    symbol.setAttribute('aria-hidden', 'true');
    for (let count = 0; count < [1, 2, 3, 2, 1][layer]; count++) symbol.append(element('i'));
    button.append(symbol, element('span', name));
    button.addEventListener('click', () => {playback.jump(layer); setLayer(layer);});
    byId(id).append(button);
    return button;
  });
  function setLayer(layer) {
    buttons.forEach((button, i) => {
      button.classList.toggle('current', i === layer);
      if (i === layer) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    show(layer);
  }
  return (steps, options) => {
    byId(id).dataset.layers = steps.length;
    buttons.forEach((button,i) => {button.hidden = i >= steps.length;});
    playback.load(steps, 0, options);
    setLayer(0);
  };
}

function stageContent(target, heading, explanation) {
  const section = byId(target);
  section.replaceChildren(element('h3', heading), element('p', explanation));
  return section;
}

const topics = [
  {name:'Học máy', keys:['máy học','học máy','mô hình','dữ liệu','dự đoán','huấn luyện','machine learning','trí tuệ nhân tạo','ai'], answer:'Mô hình học từ các ví dụ. Khi gặp đầu vào mới, nó dùng các mẫu đã học để dự đoán. Bạn có thể thử điều này bằng cách thêm một điểm trên biểu đồ rồi huấn luyện lại.'},
  {name:'Vận động', keys:['vận động','đi bộ','tập luyện','thể dục','bước đi','hoạt động'], answer:'Số bước và số phút vận động là hai đặc trưng có thể đưa vào mô hình. Trong bài mô phỏng, máy dùng chúng để tìm những ngày tương tự với ngày bạn nhập.'},
  {name:'X-quang', keys:['x quang','x ray','hình ảnh','ảnh','xương','khớp','gãy','điểm ảnh'], answer:'Máy tính đọc ảnh dưới dạng các điểm ảnh. Bộ lọc có thể làm hiện đường viền và vùng đổi độ sáng. Sang phần X-quang để quan sát trực tiếp.'}
];

const words = (text) => (text.toLocaleLowerCase('vi').match(/[\p{L}\p{N}]+/gu) ?? []);
const promptExamples = [
  ['Máy học dùng dữ liệu để dự đoán như thế nào?',0], ['Mô hình này học gì?',0],
  ['Huấn luyện mô hình bằng dữ liệu nào?',0], ['Machine learning là gì?',0],
  ['Vì sao đi bộ và tập luyện giúp vận động nhiều hơn?',1], ['Vận động mỗi ngày',1],
  ['Đếm số bước đi khi tập thể dục',1], ['Tập luyện giúp theo dõi hoạt động ra sao?',1],
  ['Ảnh X-quang hiển thị xương và khớp ra sao?',2], ['X-quang là gì?',2],
  ['Tìm cạnh của xương trong ảnh',2], ['Điểm ảnh thể hiện đường khớp như thế nào?',2]
];
const evaluationExamples = [
  ['Huấn luyện và dự đoán có liên quan gì?',0], ['Tìm hiểu trí tuệ nhân tạo',0],
  ['Theo dõi bước đi và hoạt động hằng ngày',1], ['Đi bộ quanh nhà',1],
  ['X ray thể hiện khớp như thế nào?',2], ['Hình ảnh xương',2]
];
function encodePrompt(prompt) {
  const tokens = words(prompt.normalize('NFC'));
  const phrases = ' '+tokens.join(' ')+' ';
  const matches = topics.map((topic) => topic.keys.filter((key) => phrases.includes(' '+key+' ')));
  return {tokens, matches, features: matches.map((hits) => Math.min(1,hits.length / 3))};
}

function trainPromptNetwork() {
  const hiddenWeights = [[.2,-.1,.04],[-.07,.16,-.09],[.06,-.08,.21]];
  const outputWeights = [[.08,.01,-.07],[-.06,.09,.02],[.01,-.04,.12]];
  const dot = (weights, input) => weights.reduce((sum, weight, i) => sum + weight * input[i], 0);
  function forward(input) {
    const hidden = hiddenWeights.map((weights) => Math.tanh(dot(weights,input)));
    const scores = outputWeights.map((weights) => Math.exp(dot(weights,hidden)));
    const total = scores.reduce((sum, score) => sum + score, 0);
    return {hidden, scores:scores.map((score) => score / total)};
  }
  const sampleInputs = promptExamples.map(([text,label]) => [encodePrompt(text).features,label]);
  const trace = [];
  const loss = () => sampleInputs.reduce((sum,[input,label]) => sum - Math.log(forward(input).scores[label]),0) / sampleInputs.length;
  trace.push({epoch:0, loss:loss(), weights:hiddenWeights.map(row => row.slice())});
  const firstInput = sampleInputs[0][0];
  const before = forward(firstInput).scores[0];
  let firstUpdate;
  for (let epoch = 1; epoch <= 240; epoch++) {
    for (const [sampleIndex,[input, label]] of sampleInputs.entries()) {
      const {hidden, scores} = forward(input);
      const error = scores.map((score,i) => score - Number(i === label));
      const signal = hidden.map((activation,h) => (1 - activation ** 2) * outputWeights.reduce((sum, row, i) => sum + row[h] * error[i], 0));
      outputWeights.forEach((row,i) => row.forEach((weight,h) => {row[h] = weight - .13 * error[i] * hidden[h];}));
      hiddenWeights.forEach((row,h) => row.forEach((weight,i) => {row[i] = weight - .13 * signal[h] * input[i];}));
      if (epoch === 1 && sampleIndex === 0) firstUpdate = {before, after:forward(firstInput).scores[0], error:-Math.log(scores[label]), weight:hiddenWeights[0][0]};
    }
    if ([1,5,20,60,120,240].includes(epoch)) trace.push({epoch, loss:loss(), weights:hiddenWeights.map(row => row.slice())});
  }
  return {forward, trace, firstUpdate, hiddenWeights, outputWeights};

}
const promptNetwork = trainPromptNetwork();
let textRun;
function showText(layer) {
  const {prompt, tokens, matches, features, activation, winner} = textRun;
  const network = byId('prompt-network');
  network.hidden = layer !== 3;
  if (layer === 3 && typeof renderNetwork === 'function') renderNetwork(network, features, activation);
  if (layer === 0) {
    stageContent('textStage', 'Đầu vào', 'Câu hỏi đã nhận: “'+prompt+'”');
  } else if (layer === 1) {
    const target = stageContent('textStage', 'Tách câu thành ' + tokens.length + ' token minh họa', 'Mô phỏng tách theo từ và bỏ dấu câu. Mô hình ngôn ngữ thực tế có thể tách một từ thành nhiều token.');
    const row = element('div', '', 'tokens');
    tokens.forEach((token) => row.append(element('span', token)));
    target.append(row);
  } else if (layer === 2) {
    const target = stageContent('textStage', 'Chuyển câu hỏi thành 3 số đầu vào', 'Mỗi số là số từ khóa khớp của một nhóm, chia cho 3 và giới hạn ở 1.');
    const row = element('div', '', 'tokens');
    matches.forEach((hits,i) => {
      row.append(element('span', topics[i].name + ' = ' + features[i].toFixed(2) + (hits.length ? ' (' + hits.join(', ') + ')' : '')));
    });
    target.append(row);
  } else if (layer === 3) {
    const target = stageContent('textStage', 'Ba nơ-ron ẩn kết hợp các đầu vào', 'Mỗi nơ-ron nhân đầu vào với trọng số đã học rồi đổi tổng thành một tín hiệu. Tín hiệu lớp ẩn: ' + activation.hidden.map((value) => value.toFixed(2)).join(' · ') + '.');
    for (const [i, score] of activation.scores.entries()) {
      const row = element('div', '', 'score');
      const meter = element('meter');
      meter.max = 1;
      meter.value = score;
      meter.setAttribute('aria-label', topics[i].name);
      row.append(element('span', topics[i].name), meter, element('span', Math.round(score * 100) + '%'));
      target.append(row);
    }
  } else {
    stageContent('textStage', winner ? 'Phản hồi mẫu · '+winner.name : 'Cần thêm ngữ cảnh', winner ? winner.answer : 'Thử viết rõ hơn về một trong ba chủ đề: học máy, vận động hoặc X-quang.');
  }
}
const loadTextFlow = makeFlow('textFlow','textPlayback',['Đầu vào','Tách token','Mã hóa','Lớp mạng','Phản hồi'],showText);
function runText({autoplay = false} = {}) {
  const prompt = byId('promptText').value.trim();
  if (!prompt) { byId('promptText').focus(); return; }
  const {tokens,matches,features} = encodePrompt(prompt);
  const activation = promptNetwork.forward(features);
  const ranking = activation.scores.map((score,i) => ({score,i})).sort((a,b) => b.score - a.score);
  const winner = ranking[0].score >= .55 ? topics[ranking[0].i] : null;
  textRun = {prompt, tokens, matches, features, activation, winner};
  const vector = features.map(value => value.toFixed(2)).join(' · ');
  const hidden = activation.hidden.map(value => value.toFixed(2)).join(' · ');
  const scores = activation.scores.map((score,i) => topics[i].name+' '+(score*100).toFixed(1)+'%').join(' · ');
  loadTextFlow([
    ['Nhận câu hỏi', '“'+prompt+'”', 'Giữ câu hỏi để đưa vào bước tách từ.', 'Văn bản của người dùng.'],
    ['Tách token', 'Văn bản của người dùng.', 'Đưa về chữ thường, bỏ dấu câu và tách thành từng từ.', tokens.length+' token: '+(tokens.slice(0,10).join(' · ') || 'không có')+(tokens.length > 10 ? ' …' : '')+'.'],
    ['Mã hóa thành số', tokens.length+' token và các từ khóa khớp.', 'Đếm từ khóa mỗi chủ đề, chia cho 3 và giới hạn ở 1.', 'Ba giá trị theo thứ tự Học máy, Vận động, X-quang: '+vector+'.'],
    ['Qua mạng nơ-ron', 'Vector ['+vector+'].', 'Nhân đầu vào với trọng số đã học. Tín hiệu lớp ẩn: '+hidden+'.', scores+'.'],
    ['Chọn phản hồi', scores+'.', 'Chọn chủ đề có điểm cao nhất nếu đạt ngưỡng 55%.', winner ? 'Câu trả lời mẫu cho chủ đề '+winner.name+'.' : 'Mời người dùng bổ sung ngữ cảnh.']
  ], {autoplay});
}
byId('promptForm').addEventListener('submit', (event) => {event.preventDefault(); runText({autoplay:true});});
for (const button of document.querySelectorAll('[data-prompt]')) {
  button.addEventListener('click', () => {byId('promptText').value = button.dataset.prompt; runText();});
}

const original = byId('original').getContext('2d', {willReadFrequently:true});
const transformed = byId('transformed').getContext('2d');
const size = 240;
let uploaded = null;
let fileRequest = 0;
let imageRun;
const markColor = '#ffcf65';

function makeSample(type, offset = 0, crackWidth = 6, context = original, crackTint = 0) {
  context.fillStyle = '#111921';
  context.fillRect(0,0,size,size);
  const field = context.createRadialGradient(122,109,8,122,109,132);
  field.addColorStop(0,'#404953');
  field.addColorStop(1,'#111921');
  context.fillStyle = field;
  context.fillRect(0,0,size,size);
  const bone = context.createLinearGradient(59,0,183,0);
  for (const [offset,color] of [[0,'#717f89'],[.22,'#c5cfd2'],[.46,'#939fa7'],[.67,'#d1d9da'],[1,'#6d7b85']]) bone.addColorStop(offset,color);
  const lowerEdge = (type === 'narrow' ? 121 : 140) + offset;
  context.strokeStyle = '#d0dadd';
  context.lineWidth = 2;
  context.fillStyle = bone;
  context.beginPath();
  context.moveTo(92,8); context.lineTo(145,8);
  context.bezierCurveTo(144,62,155,76,171,99);
  context.bezierCurveTo(181,126,149,122,122,115);
  context.bezierCurveTo(91,127,55,123,67,101);
  context.bezierCurveTo(89,75,91,52,92,8);
  context.fill(); context.stroke();
  context.beginPath();
  context.moveTo(70,lowerEdge+7);
  context.quadraticCurveTo(89,lowerEdge-7,120,lowerEdge);
  context.quadraticCurveTo(155,lowerEdge-6,173,lowerEdge+8);
  context.quadraticCurveTo(152,lowerEdge+43,148,233);
  context.lineTo(96,233);
  context.quadraticCurveTo(94,lowerEdge+43,70,lowerEdge+7);
  context.fill(); context.stroke();
  context.globalAlpha = .12;
  for (let x = 93; x < 151; x += 4) {
    context.beginPath(); context.moveTo(x,15); context.quadraticCurveTo(x-9,61,x+8,102); context.stroke();
    context.beginPath(); context.moveTo(x,lowerEdge+15); context.quadraticCurveTo(x+8,190,x,226); context.stroke();
  }
  context.globalAlpha = 1;
  if (type === 'crack') {
    context.beginPath(); context.moveTo(83,83);
    context.lineTo(105,80); context.lineTo(120,86); context.lineTo(137,81); context.lineTo(157,84);
    context.lineWidth = crackWidth; context.strokeStyle = 'rgb('+(50+crackTint)+','+(61+crackTint)+','+(71+crackTint)+')'; context.stroke();
  }
}

function grayAt(data, x, y) {
  const i = (y * size + x) * 4;
  return Math.round(.299 * data[i] + .587 * data[i+1] + .114 * data[i+2]);
}
function grayscale(image) {
  const gray = new ImageData(size,size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    gray.data[i] = gray.data[i+1] = gray.data[i+2] = grayAt(image.data,x,y);
    gray.data[i+3] = 255;
  }
  return gray;
}
function edgeMap(gray) {
  const edges = new ImageData(size,size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    let value = 0;
    if (y && x && y < size - 1 && x < size - 1) {
      const dx = gray.data[i+4] - gray.data[i-4];
      const dy = gray.data[i+4*size] - gray.data[i-4*size];
      value = Math.min(255, Math.hypot(dx,dy)*2.6);
    }
    edges.data[i] = Math.round(value*.58);
    edges.data[i+1] = value;
    edges.data[i+2] = Math.round(value*.86);
    edges.data[i+3] = 255;
  }
  return edges;
}
function inspectSample(gray) {
  let gap = 0;
  for (let y = 115; y <= 145; y++) if (grayAt(gray.data,120,y) < 100) gap++;
  const contrast = (grayAt(gray.data,120,75)+grayAt(gray.data,120,94))/2 - grayAt(gray.data,120,85);
  return {gap, contrast: Math.round(contrast)};
}
const syntheticXrayLabels = {
  normal:'Khe khớp rộng',
  crack:'Vệt đứt gãy',
  narrow:'Khe khớp hẹp'
};
function measureSyntheticXray(type, context, offset = 0, width = 6, tint = 0) {
  makeSample(type,offset,width,context,tint);
  return inspectSample(grayscale(context.getImageData(0,0,size,size)));
}
function trainImageModel() {
  const training = [
    ['normal',-2,0], ['normal',3,0], ['normal',0,0],
    ['crack',-3,5], ['crack',2,7], ['crack',1,9],
    ['narrow',-1,0], ['narrow',1,0], ['narrow',3,0]
  ].map(([label,offset,width]) => {
    const values = measureSyntheticXray(label,original,offset,width);
    return {label,...values};
  });
  function threshold(feature, positiveLabel) {
    const mean = (rows) => rows.reduce((sum,row) => sum + row[feature],0) / rows.length;
    const positive = training.filter((row) => row.label === positiveLabel);
    const other = training.filter((row) => row.label !== positiveLabel);
    return (mean(positive) + mean(other))/2;
  }
  return {crack:threshold('contrast','crack'), gap:threshold('gap','narrow'), count:training.length};
}
const imageModel = trainImageModel();
function markInspectionPixel(y = 85) {
  transformed.save();
  transformed.lineWidth = 1.5;
  transformed.strokeStyle = markColor;
  transformed.strokeRect(113,y-7,14,14);
  transformed.restore();
}
function showImage(layer) {
  const {prompt, local, gray, edges, sample, wantsCrack, wantsGap} = imageRun;
  const captions = ['Ảnh đầu vào','Ảnh thang xám','Bản đồ cạnh','Vùng đo minh họa','Kết quả mô phỏng'];
  byId('transformedLabel').textContent = captions[layer];
  if (layer === 0) transformed.drawImage(original.canvas,0,0);
  else transformed.putImageData(layer === 2 || local && layer > 2 ? edges : gray,0,0);

  if (layer === 0) {
    stageContent('imageStage','Ảnh và yêu cầu','Prompt đã nhận: “'+prompt+'”');
  } else if (layer === 1) {
    const target = stageContent('imageStage','Đưa ảnh về cùng định dạng','Mô hình nhìn thấy lưới 240 × 240 điểm ảnh. Mỗi điểm có một giá trị độ sáng từ 0 đến 255.');
    const i = (85 * size + 120) * 4;
    const rgb = original.getImageData(120,85,1,1).data;
    target.append(element('p','Ví dụ ở điểm (120, 85), các kênh đỏ, lục, lam ['+[...rgb.slice(0,3)].join(', ')+'] được gộp thành mức xám '+gray.data[i]+'.'));
    markInspectionPixel();
  } else if (layer === 2) {
    const target = stageContent('imageStage','Phát hiện cạnh','Bộ lọc so sánh độ sáng giữa các điểm ảnh lân cận. Vùng đổi sáng mạnh hiện rõ trên bản đồ cạnh.');
    const edgeAt = y => edges.data[(y * size + 120) * 4 + 1];
    let edgeY = 70;
    for (let y = 71; y <= 148; y++) if (edgeAt(y) > edgeAt(edgeY)) edgeY = y;
    const w = grayAt(gray.data,119,edgeY), e = grayAt(gray.data,121,edgeY);
    const n = grayAt(gray.data,120,edgeY-1), s = grayAt(gray.data,120,edgeY+1);
    target.append(element('p','Ở điểm đánh dấu (120, '+edgeY+'), chênh lệch ngang là '+e+' − '+w+' = '+(e-w)+', chênh lệch dọc là '+s+' − '+n+' = '+(s-n)+'. Hai số này cho cường độ cạnh '+edgeAt(edgeY)+'/255.'));
    markInspectionPixel(edgeY);
  } else if (local) {
    stageContent('imageStage','Ảnh từ máy · Bản đồ cạnh','Các lớp xử lý dừng ở bản đồ cạnh. Kết quả về xương khớp chỉ có trên ba ảnh giả lập.');
  } else if (!wantsCrack && !wantsGap) {
    stageContent('imageStage','Chọn đặc trưng cần xem','Để mô phỏng tiếp, hãy nhập yêu cầu có “đứt gãy”, “xương” hoặc “khe khớp”, hoặc bấm một yêu cầu mẫu rồi chạy lại.');
  } else {
    transformed.strokeStyle = markColor;
    transformed.lineWidth = 2;
    if (wantsCrack) transformed.strokeRect(87,74,63,22);
    if (wantsGap) transformed.strokeRect(111,114,19,32);
    if (layer === 3) {
      const details = [];
      if (wantsCrack) details.push('Độ tương phản của vệt tối: '+sample.contrast);
      if (wantsGap) details.push('Bề rộng khe tối: '+sample.gap+' pixel');
      stageContent('imageStage','Đo đặc trưng trong vùng đánh dấu',details.join(' · ')+'.');
    } else {
      const details = [];
      if (wantsCrack) details.push(sample.contrast >= imageModel.crack ? 'Có vệt đứt gãy giả lập' : 'Không thấy vệt đứt gãy trong mẫu');
      if (wantsGap) details.push(sample.gap < imageModel.gap ? 'Khe khớp hẹp trong mẫu' : 'Khe khớp rộng trong mẫu');
      const target = stageContent('imageStage','Nhãn dự đoán cho ảnh giả lập',details.join(' · ')+'.');
      const thresholds = [];
      if (wantsCrack) thresholds.push('tương phản từ '+imageModel.crack.toFixed(1)+' cho nhãn vệt đứt gãy');
      if (wantsGap) thresholds.push('khe tối dưới '+imageModel.gap.toFixed(1)+' pixel cho nhãn khe hẹp');
      target.append(element('p','Ngưỡng học từ '+imageModel.count+' ảnh giả lập: '+thresholds.join(' · ')+'.'));
    }
  }
}
const loadImageFlow = makeFlow('imageFlow','imagePlayback',['Ảnh và prompt','Thang xám','Tìm cạnh','Đo đặc trưng','Dự đoán'],showImage);
function runImage({autoplay = false} = {}) {
  const prompt = byId('xrayPrompt').value.trim();
  if (!prompt) {byId('xrayPrompt').focus(); return;}
  if (uploaded) {
    original.fillStyle = '#111921';
    original.fillRect(0,0,size,size);
    const scale = Math.min(size / uploaded.naturalWidth, size / uploaded.naturalHeight);
    const w = uploaded.naturalWidth * scale;
    const h = uploaded.naturalHeight * scale;
    original.drawImage(uploaded,(size-w)/2,(size-h)/2,w,h);
  } else makeSample(byId('xraySource').value);
  const gray = grayscale(original.getImageData(0,0,size,size));
  imageRun = {
    prompt, gray, edges: edgeMap(gray), local: Boolean(uploaded),
    sample: uploaded ? null : inspectSample(gray),
    wantsCrack: /gãy|vết nứt|đứt|xương/i.test(prompt),
    wantsGap: /khớp|khe/i.test(prompt)
  };
  const {local, sample, wantsCrack, wantsGap} = imageRun;
  const steps = [
    ['Nhận ảnh và yêu cầu', local ? 'Ảnh chọn từ máy.' : byId('xraySource').selectedOptions[0].textContent+'.', 'Nhận prompt “'+prompt+'”.', 'Ảnh đã nạp và yêu cầu cần kiểm tra.'],
    ['Chuyển sang thang xám', 'Ảnh RGB đã đưa về lưới 240 × 240.', 'Gộp các kênh đỏ, lục, lam thành một giá trị sáng cho mỗi điểm.', '57.600 giá trị xám từ 0 đến 255.'],
    ['Làm nổi bật đường viền', 'Lưới các giá trị xám.', 'So chênh lệch độ sáng theo chiều ngang và dọc.', local ? 'Bản đồ cạnh. Đây là kết quả cuối cho ảnh chọn từ máy.' : 'Bản đồ cạnh để quan sát. Các phép đo tiếp theo dùng ảnh thang xám.']
  ];
  if (!local && (wantsCrack || wantsGap)) {
    const measurements = [
      wantsCrack ? 'độ tương phản '+sample.contrast : '',
      wantsGap ? 'khe tối '+sample.gap+' pixel' : ''
    ].filter(Boolean).join(' · ');
    const findings = [
      wantsCrack ? (sample.contrast >= imageModel.crack ? 'Có vệt đứt gãy giả lập' : 'Không thấy vệt đứt gãy trong mẫu') : '',
      wantsGap ? (sample.gap < imageModel.gap ? 'Khe khớp hẹp trong mẫu' : 'Khe khớp rộng trong mẫu') : ''
    ].filter(Boolean).join(' · ');
    steps.push(
      ['Đo vùng quan tâm', 'Ảnh xám và đặc trưng được yêu cầu.', 'Lấy giá trị độ sáng trong vùng được đánh dấu.', measurements+'.'],
      ['Gắn nhãn giả lập', measurements+'.', 'So với ngưỡng học từ '+imageModel.count+' ảnh mẫu giả lập.', findings+'.']
    );
  } else if (!local) {
    steps.push(['Chọn vùng quan tâm', 'Ảnh xám và prompt hiện tại.', 'Tìm yêu cầu liên quan đến vệt đứt gãy hoặc khe khớp.', 'Hãy chọn một yêu cầu mẫu để tiếp tục đến dự đoán.']);
  }
  loadImageFlow(steps, {autoplay});
}
byId('xrayForm').addEventListener('submit', (event) => {event.preventDefault(); runImage({autoplay:true});});
for (const button of document.querySelectorAll('[data-xprompt]')) {
  button.addEventListener('click', () => {byId('xrayPrompt').value = button.dataset.xprompt; runImage();});
}
byId('xraySource').addEventListener('change', () => {
  fileRequest++;
  uploaded = null;
  byId('xrayFile').value = '';
  byId('xrayFileNote').textContent = 'Đang dùng ảnh giả lập.';
  runImage();
});
byId('xrayFile').addEventListener('change', (event) => {
  const request = ++fileRequest;
  const file = event.target.files[0];
  uploaded = null;
  runImage();
  if (!file) {
    byId('xrayFileNote').textContent = 'Đang dùng ảnh giả lập.';
    return;
  }
  if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 12 * 1024 * 1024) {
    event.target.value = '';
    byId('xrayFileNote').textContent = 'Chọn ảnh PNG, JPEG hoặc WebP có dung lượng tối đa 12 MB.';
    return;
  }
  byId('xrayFileNote').textContent = 'Đang mở ảnh…';
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    URL.revokeObjectURL(url);
    if (request !== fileRequest) return;
    uploaded = image;
    byId('xrayFileNote').textContent = 'Đã mở ảnh trên thiết bị này.';
    runImage();
  };
  image.onerror = () => {
    URL.revokeObjectURL(url);
    if (request !== fileRequest) return;
    event.target.value = '';
    byId('xrayFileNote').textContent = 'Ảnh không đọc được. Hãy chọn ảnh khác.';
  };
  image.src = url;
});
runText();
runImage();
