'use strict';

const decimal = new Intl.NumberFormat('vi-VN',{minimumFractionDigits:2,maximumFractionDigits:3});
const format = (value) => decimal.format(value);
const percent = (value) => Math.round(value * 100) + '%';
const vector = (values) => '[' + values.map(format).join(' · ') + ']';

function svgNode(tag, attributes, label = '') {
  const node = document.createElementNS('http://www.w3.org/2000/svg',tag);
  for (const [name,value] of Object.entries(attributes)) node.setAttribute(name,value);
  if (label) node.textContent = label;
  return node;
}

function renderNetwork(target, features, activation) {
  const graph = svgNode('svg',{viewBox:'0 0 630 227',role:'img','aria-label':'Mạng nơ-ron gồm ba đầu vào, ba nơ-ron ẩn và ba điểm đầu ra',class:'network-graph'});
  const x = [110,315,520];
  const y = [66,122,178];
  const values = [features,activation.hidden,activation.scores];
  const weights = [promptNetwork.hiddenWeights,promptNetwork.outputWeights];
  const captions = topics.map(topic => topic.name);
  weights.forEach((matrix,layer) => matrix.forEach((row,destination) => row.forEach((weight,source) => {
    const active = Math.abs(values[layer][source]) > .001;
    const line = svgNode('line',{
      x1:x[layer],y1:y[source],x2:x[layer+1],y2:y[destination],
      stroke:active ? (weight >= 0 ? '#297d86' : '#975493') : '#aab8c3',
      'stroke-width':active ? Math.min(4,1+Math.abs(weight)/2) : 1.2,
      'stroke-dasharray':weight < 0 ? '5 4' : 'none',opacity:active ? .8 : .33
    });
    line.append(svgNode('title',{},'Trọng số '+format(weight)));
    graph.append(line);
  })));
  ['Đầu vào','Lớp ẩn','Đầu ra'].forEach((label,i) => graph.append(svgNode('text',{x:x[i],y:22,'text-anchor':'middle',class:'network-heading'},label)));
  values.forEach((column,layer) => column.forEach((value,i) => {
    graph.append(svgNode('circle',{cx:x[layer],cy:y[i],r:22,fill:['#e1f2fb','#e4f6ef','#f1e9fa'][layer],stroke:['#17628b','#087865','#6c45b5'][layer],'stroke-width':2}));
    graph.append(svgNode('text',{x:x[layer],y:y[i]+4,'text-anchor':'middle',class:'network-value'},layer === 2 ? percent(value) : format(value)));
    const labelX = layer === 0 ? 82 : layer === 1 ? x[layer] : 548;
    const labelY = layer === 1 ? y[i]+38 : y[i]+4;
    graph.append(svgNode('text',{x:labelX,y:labelY,'text-anchor':['end','middle','start'][layer],class:'network-label'},layer === 1 ? 'H'+(i+1) : captions[i]));
  }));
  const detail = element('details','','math-detail');
  detail.append(element('summary','Xem cách tính nơ-ron H1'));
  const coefficients = promptNetwork.hiddenWeights[0];
  const terms = features.map((value,i) => '('+format(value)+' × '+format(coefficients[i])+')');
  const total = features.reduce((sum,value,i) => sum + value*coefficients[i],0);
  detail.append(element('p','Tổng có trọng số = '+terms.join(' + ')+' ≈ '+format(total)+'. Mạng đưa tổng qua hàm tanh để nhận tín hiệu H1 ≈ '+format(activation.hidden[0])+'.'));
  target.replaceChildren(graph,element('p','Mỗi đường là một trọng số đã học. Đường nét đứt là trọng số âm. Tỷ lệ ở đầu ra là điểm phân loại trong demo.','sub'),detail);
}

const exampleSelect = byId('guide-example');
const guidePanel = byId('guide-panel');
const guideSteps = [
  {name:'Thu thập dữ liệu',icon:'▤',description:'Lấy các câu hỏi có thể gặp và gắn chủ đề để máy có ví dụ học.'},
  {name:'Tiền xử lý',icon:'⋮',description:'Đưa văn bản về dạng số để mạng có thể tính toán.'},
  {name:'Kiến trúc mô hình',icon:'◉',description:'Xem số đi từ đầu vào, qua nơ-ron ẩn rồi trở thành điểm cho từng chủ đề.'},
  {name:'Huấn luyện',icon:'↗',description:'Mạng dự đoán, so với nhãn đúng, rồi điều chỉnh trọng số để giảm sai số.'},
  {name:'Đánh giá & triển khai',icon:'✓',description:'Kiểm tra bằng câu hỏi giữ riêng, sau đó dùng mô hình đã học với đầu vào mới.'}
];
const samples = [promptExamples[0],promptExamples[4],promptExamples[8]];
let guideIndex = 0;
const guidePlayback = createPlayback('guidePlayback', setGuide);
const guideButtons = guideSteps.map((step,i) => {
  const button = element('button','','guide-step');
  button.type = 'button';
  button.style.setProperty('--step-color',['#216b99','#087865','#a44b20','#936716','#813b76'][i]);
  const icon = element('span',step.icon,'guide-icon');
  icon.setAttribute('aria-hidden','true');
  button.append(icon,element('span','Bước '+(i+1),'guide-kicker'),element('strong',step.name));
  button.addEventListener('click',() => {guidePlayback.jump(i); setGuide(i);});
  byId('guideFlow').append(button);
  return button;
});

function guideCards(cards) {
  const row = element('div','','guide-cards');
  for (const [title,content] of cards) {
    const box = element('section','','data-card');
    box.append(element('h3',title),element('p',content));
    row.append(box);
  }
  guidePanel.append(row);
}

function appendTokens(tokens, panel = guidePanel) {
  const row = element('div','','tokens');
  tokens.forEach(token => row.append(element('span',token)));
  panel.append(row);
}

function labeledTable(headers, rows) {
  const wrap = element('div','','table-wrap');
  const table = element('table','','guide-table');
  const head = element('thead'), headRow = element('tr'), body = element('tbody');
  headers.forEach(header => {
    const cell = element('th',header);
    cell.scope = 'col';
    headRow.append(cell);
  });
  head.append(headRow);
  for (const row of rows) {
    const tr = element('tr');
    row.forEach(cell => tr.append(element('td',cell)));
    body.append(tr);
  }
  table.append(head,body);
  wrap.append(table);
  return wrap;
}

function addTrainingTrace() {
  const trace = promptNetwork.trace;
  const update = promptNetwork.firstUpdate;
  const [firstQuestion,firstLabel] = promptExamples[0];
  const detail = element('details','','math-detail');
  detail.open = true;
  detail.append(element('summary','Xem lần cập nhật trọng số đầu tiên'));
  detail.append(element('p','Câu được xử lý đầu tiên là “'+firstQuestion+'”. Điểm cho nhãn đúng “'+topics[firstLabel].name+'” tăng từ '+format(update.before*100)+'% lên '+format(update.after*100)+'%'+' sau một lần cập nhật. Sai số của lần dự đoán đầu là '+format(update.error)+'.'));
  detail.append(element('p','Lan truyền ngược tính mức mỗi trọng số góp vào sai số. Trọng số nối đặc trưng Học máy với nơ-ron H1 đổi từ '+format(trace[0].weights[0][0])+' thành '+format(update.weight)+'.'));
  guidePanel.append(detail);
  const chart = svgNode('svg',{viewBox:'0 0 600 175',class:'loss-graph',role:'img','aria-label':'Sai số trung bình ở '+trace.map(({epoch,loss}) => 'vòng '+epoch+' là '+format(loss)).join(', ')});
  const x = i => 55+i*82;
  const y = loss => 127-loss/trace[0].loss*94;
  chart.append(svgNode('line',{x1:45,y1:127,x2:557,y2:127,stroke:'#9aafb2'}));
  chart.append(svgNode('polyline',{points:trace.map(({loss},i) => x(i)+','+y(loss)).join(' '),fill:'none',stroke:'#087865','stroke-width':3}));
  trace.forEach(({epoch,loss},i) => {
    chart.append(svgNode('circle',{cx:x(i),cy:y(loss),r:5,fill:'#087865'}),svgNode('text',{x:x(i),y:y(loss)-9,'text-anchor':'middle'},format(loss)),svgNode('text',{x:x(i),y:149,'text-anchor':'middle'},String(epoch)));
  });
  chart.append(svgNode('text',{x:301,y:170,'text-anchor':'middle'},'Các vòng huấn luyện được ghi lại'));
  guidePanel.append(chart);
}

function prediction(question) {
  const scores = promptNetwork.forward(encodePrompt(question).features).scores;
  const best = scores.indexOf(Math.max(...scores));
  return scores[best] >= .55 ? best : -1;
}
function renderEvaluation(selected) {
  const records = evaluationExamples.map(([question,label]) => ({question,label,actual:prediction(question)}));
  const correct = records.filter(record => record.actual === record.label).length;
  const label = index => topics[index]?.name ?? 'Cần thêm ngữ cảnh';
  guideCards([
    ['Dữ liệu vào',records.length+' câu hỏi giữ riêng khi huấn luyện.'],
    ['Cách kiểm thử','So nhãn dự đoán với nhãn đã gắn cho mỗi câu.'],
    ['Kết quả',correct+'/'+records.length+' câu đúng trên bộ minh họa nhỏ này.']
  ]);
  guidePanel.append(labeledTable(['Câu hỏi kiểm thử','Nhãn đúng','Mạng dự đoán'], records.map(row => [row.question,label(row.label),label(row.actual)])));
  const button = element('button','Thử một câu mới từ bộ kiểm thử');
  button.type = 'button';
  button.addEventListener('click',() => {
    byId('promptText').value = evaluationExamples[selected*2][0];
    runText();
    showTab(byId('tab-prompt'));
    byId('promptText').focus();
  });
  guidePanel.append(button);
}

function setGuide(index) {
  guideIndex = index;
  guideButtons.forEach((button,i) => {
    if (index === i) button.setAttribute('aria-current','step');
    else button.removeAttribute('aria-current');
  });
  const selected = Number(exampleSelect.value);
  const [question,label] = samples[selected];
  const {tokens,matches,features} = encodePrompt(question);
  const stage = guideSteps[index];
  guidePanel.replaceChildren(element('h2',stage.name),element('p',stage.description,'guide-description'));
  if (index === 0) {
    guideCards([['Dữ liệu thô','“'+question+'”'],['Gắn nhãn','Chủ đề đúng là “'+topics[label].name+'”.'],['Chuyển tiếp',promptExamples.length+' câu đã gắn nhãn để huấn luyện · '+evaluationExamples.length+' câu khác giữ riêng để kiểm thử.']]);
    guidePanel.append(labeledTable(['Câu hỏi mẫu đang theo dõi','Nhãn'],samples.map(([text,id]) => [text, topics[id].name])));
  } else if (index === 1) {
    guideCards([['Dữ liệu vào','“'+question+'”'],['Xử lý','Chuyển thành chữ thường, bỏ dấu câu, tách từ và đếm từ khóa theo ba chủ đề.'],['Chuyển tiếp',vector(features)+' theo thứ tự Học máy, Vận động, X-quang.']]);
    appendTokens(tokens);
    guidePanel.append(labeledTable(['Chủ đề','Từ khóa khớp','Giá trị'],topics.map((topic,i) => [topic.name,matches[i].join(', ') || 'Không có',format(features[i])])));
  } else if (index === 2) {
    const output = promptNetwork.forward(features);
    guideCards([['Đầu vào',vector(features)],['Lớp ẩn',vector(output.hidden)],['Đầu ra',output.scores.map(percent).join(' · ')+' theo thứ tự Học máy, Vận động, X-quang.']]);
    const network = element('div');
    renderNetwork(network,features,output);
    guidePanel.append(network,element('p','Các giá trị trên sơ đồ dùng trọng số sau huấn luyện. Bước tiếp theo cho thấy chúng được cập nhật ra sao.','sub'));
  } else if (index === 3) {
    const trace = promptNetwork.trace;
    guideCards([['Lan truyền thuận','Dùng dữ liệu số và trọng số hiện tại để tính điểm cho các chủ đề.'],['Tính sai số & lan truyền ngược','So điểm với nhãn đúng, tính hướng điều chỉnh rồi cập nhật trọng số.'],['Kết quả sau 240 vòng','Sai số trung bình từ '+format(trace[0].loss)+' xuống '+format(trace.at(-1).loss)+'.']]);
    addTrainingTrace();
  } else renderEvaluation(selected);
}
function loadGuide(index = 0) {
  const [question,label] = samples[Number(exampleSelect.value)];
  const {tokens,features} = encodePrompt(question);
  const output = promptNetwork.forward(features);
  const trace = promptNetwork.trace;
  const correct = evaluationExamples.filter(([text,expected]) => prediction(text) === expected).length;
  guidePlayback.load([
    ['Thu thập và gắn nhãn', '“'+question+'”', 'Gắn nhãn chủ đề “'+topics[label].name+'” và giữ riêng bộ câu hỏi kiểm thử.', promptExamples.length+' câu có nhãn để huấn luyện.'],
    ['Tiền xử lý', 'Câu hỏi đã gắn nhãn “'+topics[label].name+'”.', 'Tách '+tokens.length+' token và mã hóa từ khóa theo ba chủ đề.', 'Vector '+vector(features)+' kèm nhãn “'+topics[label].name+'”.'],
    ['Đi qua kiến trúc mạng', 'Vector '+vector(features)+'.', 'Ba nơ-ron ẩn kết hợp số đầu vào với trọng số.', 'Minh họa với trọng số đã học: '+output.scores.map((score,i) => topics[i].name+' '+percent(score)).join(' · ')+'.'],
    ['Học từ sai số', promptExamples.length+' vector đã gắn nhãn và các trọng số ban đầu.', 'Dự đoán, so với nhãn đúng rồi cập nhật trọng số trong 240 vòng.', 'Mô hình đã học. Sai số huấn luyện trung bình '+format(trace[0].loss)+' giảm còn '+format(trace.at(-1).loss)+'.'],
    ['Đánh giá và dùng mô hình', evaluationExamples.length+' câu hỏi giữ riêng và trọng số đã học.', 'Dự đoán cho từng câu rồi đối chiếu với nhãn đúng.', correct+'/'+evaluationExamples.length+' câu đúng trên bộ minh họa. Có thể tiếp tục với một prompt mới.']
  ],index);
  setGuide(index);
}
exampleSelect.addEventListener('change',() => loadGuide(guideIndex));
loadGuide();
