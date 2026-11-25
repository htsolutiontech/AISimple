'use strict';

(() => {
const get = id => document.getElementById('nl-' + id);
const pointNames = ['x₁', 'x₂', 'x₁²', 'x₂²', 'x₁ × x₂'];
const xrayNames = ['Tương phản','Bề rộng khe'];
const isXray = () => get('data').value === 'xray';
const isText = () => get('data').value === 'capital';
const featureNames = () => isText() ? ['Việt Nam','Thái Lan'] : isXray() ? xrayNames : pointNames;
const capitalQuestions = [
  [['Thủ đô của Việt Nam là thành phố nào?',1],['Việt Nam có thủ đô ở đâu?',1],['Cho biết thủ đô nước Việt Nam',1],['Thành phố nào là thủ đô của Việt Nam?',1],
   ['Thủ đô của Thái Lan là thành phố nào?',0],['Thái Lan có thủ đô ở đâu?',0],['Cho biết thủ đô nước Thái Lan',0],['Thành phố nào là thủ đô của Thái Lan?',0]],
  [['Tên thủ đô Việt Nam là gì?',1],['Ở Việt Nam, đâu là thủ đô?',1],['Tên thủ đô Thái Lan là gì?',0],['Ở Thái Lan, đâu là thủ đô?',0]]
];
let textProbe;
function encodeCapital(question) {
  const tokens = words(question.normalize('NFC'));
  const text = ' '+tokens.join(' ').normalize('NFD').replace(/\p{M}/gu,'').replaceAll('đ','d')+' ';
  const point = [Number(text.includes(' viet nam ')),Number(text.includes(' thai lan '))];
  const supported = text.includes(' thu do ') && point[0]+point[1] === 1;
  return {question,tokens,point,supported};
}
const taskLabel = () => syntheticXrayLabels[get('xray-task').value];
const labelFor = label => isText() ? (label ? 'Hà Nội' : 'Bangkok') : isXray() ? (label ? 'Có '+taskLabel().toLocaleLowerCase('vi') : 'Không có '+taskLabel().toLocaleLowerCase('vi')) : (label ? 'Nhóm cam' : 'Nhóm xanh');
const preview = get('xray-preview').getContext('2d',{willReadFrequently:true});
let xrayMeasurements;
let xraySets;
function normalizeXray({contrast,gap}) {
  return [(contrast+30)*2/190-1, gap*2/31-1];
}
function updateXrayPreview() {
  xrayMeasurements = measureSyntheticXray(get('xray-sample').value,preview);
  preview.strokeStyle = '#ffcf65';
  preview.lineWidth = 2;
  preview.strokeRect(87,74,63,22);
  preview.strokeRect(111,114,19,32);
  get('xray-measurements').textContent = 'Tương phản '+xrayMeasurements.contrast+' · Bề rộng khe '+xrayMeasurements.gap+' px';
}
function xrayDataset() {
  if (!xraySets) {
    const context = document.createElement('canvas').getContext('2d',{willReadFrequently:true});
    context.canvas.width = context.canvas.height = size;
    const rng = randomGenerator(3829);
    xraySets = [16,8].map(count => Object.keys(syntheticXrayLabels).flatMap(kind =>
      Array.from({length:count}, () => {
        const offset = -4+8*rng();
        const width = 4.5+4*rng();
        const tint = -12+34*rng();
        return {point:normalizeXray(measureSyntheticXray(kind,context,offset,width,tint)),kind};
      })
    ));
  }
  return xraySets.map(set => set.map(({point,kind}) => ({point,label:Number(kind === get('xray-task').value)})));
}
const format = new Intl.NumberFormat('vi-VN', {maximumFractionDigits:3});
const f = value => format.format(value);
const list = values => '[' + values.map(f).join(' · ') + ']';
const blue = '#1c6596';
const orange = '#ad531b';
const gridSize = 42;
let hiddenSizes = [4, 3];
let enabled;
let hiddenActivation;
let model;
let training;
let testing;
let epoch;
let history;
let timer;
let chosenLayer = 0;
let chosenNeuron = 0;
let chosenStep = 0;
let maps;
const map = get('map');
const loss = get('loss');
const probe = () => isText() ? textProbe.point : isXray() ? normalizeXray(xrayMeasurements) : [Number(get('x').value), Number(get('y').value)];
const trace = createPlayback('nl-trace', index => {
  stop();
  chosenStep = index;
  chosenLayer = Math.max(0,index-traceOffset());
  chosenNeuron = 0;
  renderSelection();
});

function randomGenerator(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
const traceOffset = () => isText() ? 2 : isXray() ? 1 : 0;
function dataset() {
  if (isText()) return capitalQuestions.map(set => set.map(([question,label]) => ({point:encodeCapital(question).point,label})));
  if (isXray()) return xrayDataset();
  const rnd = randomGenerator(5381);
  const kind = get('data').value;
  const noise = Number(get('noise').value)/100;
  const samples = Array.from({length:160}, (_,i) => {
    const label = i % 2;
    const angle = rnd()*Math.PI*2;
    let x, y;
    if (kind === 'rings') {
      const r = label ? .62 + rnd()*.26 : Math.sqrt(rnd())*.43;
      x = Math.cos(angle)*r;
      y = Math.sin(angle)*r;
    } else if (kind === 'clusters') {
      const sign = label ? 1 : -1;
      x = sign*.46 + Math.cos(angle)*rnd()*.37;
      y = sign*.38 + Math.sin(angle)*rnd()*.37;
    } else {
      const side = rnd() < .5 ? -1 : 1;
      x = side*(.27 + rnd()*.48);
      y = side*(label ? -1 : 1)*(.27 + rnd()*.48);
    }
    const jitter = value => Math.max(-1,Math.min(1,value+(rnd()-.5)*noise));
    return {point:[jitter(x),jitter(y)],label};
  });
  for (let i = samples.length-1; i > 0; i--) {
    const j = Math.floor(rnd()*(i+1));
    [samples[i],samples[j]] = [samples[j],samples[i]];
  }
  return [samples.slice(0,112),samples.slice(112)];
}
function features([x,y]) {
  const all = [x,y,x*x,y*y,x*y];
  return enabled.map(index => all[index]);
}
function newModel() {
  const rnd = randomGenerator(731);
  return [...hiddenSizes,1].map((width,i) => {
    const fan = i === 0 ? enabled.length : hiddenSizes[i-1];
    const bound = Math.sqrt(6/(fan+width));
    return Array.from({length:width}, () => ({
      weights:Array.from({length:fan}, () => (rnd()*2-1)*bound),
      bias:(rnd()-.5)*.08
    }));
  });
}
const sigmoid = z => 1/(1+Math.exp(-z));
function activate(z, last) {
  if (last) return sigmoid(z);
  return hiddenActivation === 'relu' ? Math.max(0,z) : Math.tanh(z);
}
function forward(input) {
  const activations = [input];
  const sums = [];
  for (const [i,layer] of model.entries()) {
    const previous = activations[i];
    const pre = layer.map(({weights,bias}) => weights.reduce((sum,w,j) => sum+w*previous[j],bias));
    sums.push(pre);
    activations.push(pre.map(z => activate(z,i === model.length-1)));
  }
  return {activations,sums};
}
function trainEpoch() {
  const rate = Number(get('rate').value);
  const relu = hiddenActivation === 'relu';
  const gradients = model.map(layer => layer.map(({weights}) => ({
    weights:weights.map(() => 0), bias:0
  })));
  for (const {point,label} of training) {
    const {activations,sums} = forward(features(point));
    const deltas = model.map(() => []);
    deltas.at(-1)[0] = activations.at(-1)[0] - label;
    for (let i = model.length-2; i >= 0; i--) {
      deltas[i] = model[i].map((_,j) => {
        const incoming = model[i+1].reduce((sum,node,k) => sum+node.weights[j]*deltas[i+1][k],0);
        const derivative = relu ? Number(sums[i][j] > 0) : 1-activations[i+1][j]**2;
        return incoming*derivative;
      });
    }
    gradients.forEach((layer,i) => layer.forEach((gradient,j) => {
      const delta = deltas[i][j];
      gradient.bias += delta;
      gradient.weights.forEach((_,k) => { gradient.weights[k] += delta*activations[i][k]; });
    }));
  }
  const step = rate/training.length;
  model.forEach((layer,i) => layer.forEach((node,j) => {
    const gradient = gradients[i][j];
    node.bias -= step*gradient.bias;
    node.weights = node.weights.map((weight,k) => weight-step*gradient.weights[k]);
  }));
  epoch++;
}
function measure(data) {
  let correct = 0;
  let error = 0;
  for (const {point,label} of data) {
    const probability = forward(features(point)).activations.at(-1)[0];
    correct += Number(Number(probability >= .5) === label);
    error -= Math.log(Math.max(1e-12,label ? probability : 1-probability));
  }
  return {loss:error/data.length,accuracy:correct/data.length};
}

function color(value) {
  const mix = Math.min(1,Math.abs(value));
  const target = value < 0 ? [34,110,163] : [214,113,45];
  return target.map(channel => Math.round(246+(channel-246)*mix));
}
function renderMaps() {
  const layers = [enabled.length,...hiddenSizes,1].map(width => Array.from({length:width},() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = gridSize;
    const context = canvas.getContext('2d');
    return {canvas,context,pixels:context.createImageData(gridSize,gridSize)};
  }));
  for (let row = 0; row < gridSize; row++) for (let col = 0; col < gridSize; col++) {
    const {activations} = forward(features([2*(col+.5)/gridSize-1,1-2*(row+.5)/gridSize]));
    activations.forEach((layer,i) => layer.forEach((value,j) => {
      let display = value;
      if (i === activations.length-1) display = (value-.5)*2;
      const index = (row*gridSize+col)*4;
      layers[i][j].pixels.data.set([...color(display),255],index);
    }));
  }
  return layers.map(layer => layer.map(({canvas,context,pixels}) => {
    context.putImageData(pixels,0,0);
    return {canvas,url:canvas.toDataURL()};
  }));
}
function renderOutput() {
  if (isText()) {
    get('text-scores').hidden = !textProbe.supported;
    if (!textProbe.supported) {
      get('prediction').textContent = 'Câu hỏi nằm ngoài phạm vi minh họa. Hãy thử hỏi thủ đô Việt Nam hoặc Thái Lan.';
      return;
    }
    const hanoi = forward(features(probe())).activations.at(-1)[0];
    for (const [id,score] of [['hanoi',hanoi],['bangkok',1-hanoi]]) {
      get(id).value = score;
      get(id+'-value').value = f(score*100)+'%';
    }
    const name = labelFor(hanoi >= .5);
    get('prediction').textContent = epoch ? 'Câu trả lời mẫu: '+name+'.' : 'Trọng số ban đầu đang chọn '+name+'. Hãy chạy huấn luyện để mạng học từ nhãn.';
    return;
  }
  const ctx = map.getContext('2d');
  const w = map.width;
  const px = x => (x+1)*w/2;
  const py = y => (1-y)*w/2;
  ctx.drawImage(maps.at(-1)[0].canvas,0,0,w,w);
  for (const {point:[x,y],label} of testing) {
    ctx.beginPath();
    ctx.arc(px(x),py(y),3.4,0,Math.PI*2);
    ctx.fillStyle = label ? orange : blue;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  const [x,y] = probe();
  ctx.fillStyle = '#ffde79';
  ctx.fillRect(px(x)-5,py(y)-5,10,10);
  ctx.strokeStyle = '#122333';
  ctx.lineWidth = 2;
  ctx.strokeRect(px(x)-5,py(y)-5,10,10);
  get('x-value').value = f(x);
  get('y-value').value = f(y);
  const p = forward(features([x,y])).activations.at(-1)[0];
  get('prediction').textContent = isXray()
    ? 'Dự đoán minh họa: '+labelFor(p >= .5)+' · Điểm lớp dương '+f(p*100)+'%. Chấm tròn là ảnh kiểm thử.'
    : 'Ô vàng: '+labelFor(p >= .5)+' · Điểm nhóm cam '+f(p*100)+'%. Chấm tròn là dữ liệu kiểm thử.';
}
function layerLabel(i) {
  if (i === 0) return 'Đầu vào';
  if (i === model.length) return 'Đầu ra';
  return 'Lớp ẩn '+i;
}
function itemLabel(i,j) {
  if (i === 0) return featureNames()[enabled[j]];
  if (i === model.length) return isText() ? 'Điểm Hà Nội' : isXray() ? 'Điểm lớp dương' : 'Điểm nhóm cam';
  return 'Nơ-ron '+(j+1);
}
function renderGraph() {
  if (isText() && !textProbe.supported) {
    get('graph').replaceChildren(element('p','Mạng chờ câu hỏi thuộc phạm vi minh họa.','sub'));
    return;
  }
  const focused = get('graph').contains(document.activeElement) ? document.activeElement.dataset.node : null;
  const {activations} = forward(features(probe()));
  const graph = svgNode('svg',{viewBox:'0 0 590 345',class:'neural-graph',role:'group','aria-label':'Mạng nơ-ron có thể tương tác'});
  const positions = activations.map((layer,i) => {
    const x = 52+i*462/(activations.length-1);
    return layer.map((_,j) => [x,66+(j+(6-layer.length)/2)*44]);
  });
  model.forEach((layer,i) => layer.forEach((node,j) => node.weights.forEach((weight,k) => {
    const [x1,y1] = positions[i][k];
    const [x2,y2] = positions[i+1][j];
    const middle = (x1+x2)/2;
    const incoming = chosenLayer === i+1;
    const stroke = weight >= 0 ? blue : orange;
    const d = 'M'+(x1+15)+' '+y1+' C'+middle+' '+y1+' '+middle+' '+y2+' '+(x2-15)+' '+y2;
    const edge = svgNode('path',{d,stroke,'stroke-width':Math.min(5,.8+Math.abs(weight)*1.6),opacity:incoming ? .8 : .27,class:'nl-edge'});
    edge.append(svgNode('title',{},'Trọng số '+f(weight)+' · Tín hiệu × trọng số '+f(activations[i][k]*weight)));
    graph.append(edge);
    if (incoming && j === chosenNeuron && Math.abs(activations[i][k]*weight) > .0001) {
      graph.append(svgNode('path',{d,stroke,opacity:1,'stroke-width':3,'stroke-dasharray':'5 9',class:'nl-edge nl-flow-edge','pointer-events':'none'}));
    }
  })));
  positions.forEach((layer,i) => {
    graph.append(svgNode('text',{x:layer[0][0],y:28,'text-anchor':'middle'},layerLabel(i)));
    layer.forEach(([x,y],j) => {
      const selected = i === chosenLayer && j === chosenNeuron;
      const value = activations[i][j];
      const node = svgNode('g',{class:'nl-node',role:'button',tabindex:0,'aria-pressed':selected,'aria-label':layerLabel(i)+' · '+itemLabel(i,j)+' · '+f(value),'data-node':i+'-'+j});
      node.append(
        svgNode('image',{href:maps[i][j].url,x:x-15,y:y-15,width:30,height:30}),
        svgNode('rect',{x:x-16,y:y-16,width:32,height:32,rx:3,fill:'none',stroke:selected ? '#087865' : '#8297a6','stroke-width':selected ? 3 : 1.5}),
        svgNode('text',{x:x+21,y:y+5},i === 0 && !isXray() && !isText() ? featureNames()[enabled[j]] : f(value))
      );
      const select = () => {
        stop();
        chosenLayer = i;
        chosenNeuron = j;
        chosenStep = i+traceOffset();
        trace.jump(chosenStep);
        renderSelection();
      };
      node.addEventListener('click',select);
      node.addEventListener('keydown',event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          select();
        }
      });
      graph.append(node);
    });
  });
  get('graph').replaceChildren(graph);
  if (focused) graph.querySelector('[data-node="'+focused+'"]')?.focus({preventScroll:true});
}

function renderLoss() {
  const ctx = loss.getContext('2d');
  const {width,height} = loss;
  ctx.clearRect(0,0,width,height);
  const ceiling = Math.max(.75,...history.flat());
  history[0].forEach((_,series) => {
    ctx.beginPath();
    ctx.strokeStyle = series ? orange : blue;
    ctx.lineWidth = 2.5;
    ctx.setLineDash(series ? [5,4] : []);
    history.forEach((record,i) => {
      const x = 6+i*(width-12)/Math.max(history.length-1,1);
      const y = height-6-record[series]*(height-12)/ceiling;
      if (i === 0) ctx.moveTo(x,y);
      else ctx.lineTo(x,y);
      if (history.length === 1) ctx.lineTo(x+5,y);
    });
    ctx.stroke();
  });
  ctx.setLineDash([]);
}
function showCalculation() {
  const panel = get('detail');
  if (isText() && (chosenStep < traceOffset() || !textProbe.supported)) {
    panel.replaceChildren(element('strong','Từ câu hỏi đến đặc trưng'),element('p','Mô phỏng nhận diện cụm “thủ đô” và tên một trong hai nước đã học. Các từ còn lại được hiển thị trong bước tách từ.'));
    return;
  }
  const {activations,sums} = forward(features(probe()));
  const i = chosenLayer;
  const j = chosenNeuron;
  panel.replaceChildren(element('strong',layerLabel(i)+' · '+itemLabel(i,j)));
  if (isXray() && chosenStep === 0) {
    panel.replaceChildren(element('strong','Số đo từ ảnh thử'),element('p','Tương phản = độ sáng trung bình ở hai điểm tham chiếu trừ độ sáng tại vệt đo. Bề rộng khe = số điểm ảnh tối trên đường đo dọc trong khung dưới.'));
    return;
  }
  if (i === 0) {
    const input = isXray()
      ? (j === 0 ? 'Độ tương phản '+xrayMeasurements.contrast+' được chuẩn hóa bằng 2 × (giá trị + 30) / 190 − 1' : 'Bề rộng khe '+xrayMeasurements.gap+' px được chuẩn hóa bằng 2 × giá trị / 31 − 1')+' ≈ '+f(activations[0][j])+'.'
      : isText() ? 'Cụm “'+itemLabel(i,j)+'” được mã hóa thành '+activations[0][j]+' (có = 1, vắng = 0).'
      : 'Điểm thử '+list(probe())+' cho đặc trưng '+itemLabel(i,j)+' = '+f(activations[0][j])+'.';
    panel.append(element('p',input+' Giá trị đi tiếp đến '+layerLabel(1).toLowerCase()+'.'));
    return;
  }
  const node = model[i-1][j];
  const products = node.weights.map((weight,k) => '('+f(activations[i-1][k])+' × '+f(weight)+')');
  const fn = i === model.length ? 'Sigmoid' : get('activation').selectedOptions[0].textContent;
  panel.append(
    element('p','Tín hiệu lớp trước × trọng số, cộng hệ số chệch: '+products.join(' + ')+' + ('+f(node.bias)+') ≈ '+f(sums[i-1][j])+'.'),
    element('p',fn+' biến tổng này thành '+f(activations[i][j])+'. '+(i === model.length ? 'Từ 0,5 trở lên được gắn nhãn “'+labelFor(true)+'”.' : 'Giá trị này được chuyển sang lớp kế tiếp.'))
  );
}
function refreshTrace() {
  const textSteps = isText() ? [
    ['Nhận câu hỏi','“'+textProbe.question+'”','Đưa văn bản vào bộ tiền xử lý.','Câu hỏi gốc.'],
    ['Tách từ','Câu hỏi gốc.','Chuyển về chữ thường và bỏ dấu câu. Kiểm tra cụm “thủ đô” và tên nước.',textProbe.tokens.join(' · ')+(textProbe.supported ? '.' : ' · Ngoài phạm vi minh họa.')]
  ] : [];
  if (isText() && !textProbe.supported) {
    trace.load(textSteps,chosenStep);
    return;
  }
  const {activations} = forward(features(probe()));
  const steps = activations.map((layer,i) => {
    if (i === 0) {
      if (isText()) return ['Mã hóa thành số',textProbe.tokens.join(' · '),'Có “Việt Nam” hoặc “Thái Lan” thì đánh 1 ở đúng vị trí. Vắng thì đánh 0.','[Việt Nam, Thái Lan] = '+list(layer)+'.'];
      if (isXray()) {
        return ['Chuẩn hóa đặc trưng', 'Tương phản '+xrayMeasurements.contrast+' và bề rộng khe '+xrayMeasurements.gap+' px.', 'Đưa hai số đo về thang đầu vào của mạng.', list(layer)+'.'];
      }
      return ['Tạo đầu vào', 'Điểm thử '+list(probe())+'.', 'Tính đặc trưng đã chọn: '+enabled.map(k => featureNames()[k]).join(', ')+'.', list(layer)+'.'];
    }
    if (i === model.length && isText()) return ['Chọn câu trả lời',list(activations[i-1])+'.','Sigmoid tính điểm Hà Nội. Điểm Bangkok bằng 1 trừ điểm Hà Nội. Chọn đáp án có điểm cao hơn.','Hà Nội '+f(layer[0]*100)+'% · Bangkok '+f((1-layer[0])*100)+'% · Kết quả: '+labelFor(layer[0] >= .5)+'.'];
    if (i === model.length) return ['Tính kết quả', list(activations[i-1])+'.', 'Tổng có trọng số qua sigmoid tạo điểm từ 0 đến 1. Ngưỡng phân loại là 0,5.', f(layer[0]*100)+'% điểm lớp dương · '+labelFor(layer[0] >= .5)+'.'];
    return ['Tính tín hiệu lớp ẩn '+i, list(activations[i-1])+'.', 'Mỗi nơ-ron nhân đầu vào với trọng số, cộng hệ số chệch rồi áp dụng '+get('activation').selectedOptions[0].textContent+'.', list(layer)+'.'];
  });
  if (isXray()) steps.unshift(['Đo trên ảnh giả lập', 'Ảnh '+syntheticXrayLabels[get('xray-sample').value]+'.', 'Đổi sang thang xám. So độ sáng ở vùng trên và đếm pixel tối ở vùng khe.', 'Tương phản '+xrayMeasurements.contrast+' · khe '+xrayMeasurements.gap+' px.']);
  trace.load([...textSteps,...steps],chosenStep);
}
function renderSelection() {
  renderGraph();
  showCalculation();
}
function renderFrame() {
  if (!isText() || textProbe.supported) maps = renderMaps();
  renderOutput();
  renderLoss();
  refreshTrace();
  renderSelection();
}
function record() {
  const fit = measure(training);
  const test = measure(testing);
  history.push([fit.loss,test.loss]);
  if (history.length > 160) history.shift();
  get('epoch').textContent = f(epoch);
  get('loss-train').textContent = 'Sai số huấn luyện '+f(fit.loss);
  get('loss-test').textContent = 'Sai số kiểm thử '+f(test.loss)+' · '+f(test.accuracy*100)+'% đúng';
}
function advance(count) {
  for (let i = 0; i < count; i++) trainEpoch();
  record();
  renderFrame();
}
function stop() {
  clearInterval(timer);
  timer = undefined;
  get('run').textContent = 'Chạy huấn luyện';
  get('step').disabled = false;
}
function reset({warmText = false} = {}) {
  stop();
  const mode = get('data').value;
  const website = mode === 'website';
  const descriptions = {
    website:'Nhận diện tên báo, tra nguồn có sẵn và chọn trang chủ theo điểm.',
    capital:'Theo dõi câu hỏi về thủ đô từ lúc tách từ đến khi chọn đáp án.',
    xray:'Đo hai đặc trưng trên ảnh đầu gối giả lập rồi đưa vào mạng.',
    rings:'Học cách phân biệt các điểm nằm trong và ngoài một vòng tròn.',
    clusters:'Học ranh giới giữa hai cụm điểm ở hai phía.',
    xor:'Phân loại hai nhóm điểm xen kẽ ở bốn góc.'
  };
  get('data-description').textContent = descriptions[mode];
  get('layout').classList.toggle('lookup-layout',website);
  for (const id of ['toolbar','graph-card','result-card','trace-card','split']) get(id).hidden = website;
  byId('view-website').hidden = !website;
  if (website) {
    for (const id of ['noise-row','features','xray-settings','text-settings']) get(id).hidden = true;
    return;
  }
  const xray = isXray();
  const text = isText();
  get('xray-settings').hidden = !xray;
  get('xray-axes').hidden = !xray;
  get('noise-row').hidden = xray || text;
  get('features').hidden = xray || text;
  get('probe').hidden = xray || text;
  get('text-settings').hidden = !text;
  get('text-scores').hidden = !text;
  map.hidden = text;
  get('output-heading').textContent = text ? 'Kết quả câu hỏi' : 'Bản đồ dự đoán';
  map.closest('.neural-result').classList.toggle('nl-text-result',text);
  map.classList.toggle('nl-xray-map',xray);
  map.setAttribute('aria-label',xray ? 'Bản đồ dự đoán theo độ tương phản và bề rộng khe. Đổi ảnh thử bằng danh sách ảnh giả lập.' : 'Bản đồ dự đoán hai nhóm. Dùng các thanh trượt bên dưới để đổi điểm thử.');
  enabled = xray || text ? [0,1] : [...get('features').querySelectorAll('input:checked')].map(input => Number(input.value));
  if (xray) updateXrayPreview();
  if (text) textProbe = encodeCapital(get('question').value);
  hiddenActivation = get('activation').value;
  model = newModel();
  [training,testing] = dataset();
  get('noise-value').value = get('noise').value+'%';
  const unit = text ? 'câu' : xray ? 'ảnh' : 'điểm';
  get('split').textContent = training.length+' '+unit+' huấn luyện · '+testing.length+' '+unit+' giữ riêng để kiểm thử.';
  epoch = 0;
  chosenLayer = 0;
  chosenNeuron = 0;
  chosenStep = 0;
  history = [];
  record();
  if (text && warmText) {
    for (let i = 0; i < 48; i++) {
      trainEpoch();
      if (epoch % 8 === 0) record();
    }
  }
  renderFrame();
}
function renderArchitecture() {
  get('add').disabled = hiddenSizes.length === 3;
  get('remove').disabled = hiddenSizes.length === 0;
  get('counts').replaceChildren(...hiddenSizes.map((width,i) => {
    const label = element('label','Lớp ẩn '+(i+1));
    const select = element('select');
    for (let count = 1; count <= 6; count++) {
      const option = element('option',count+' nơ-ron');
      option.value = count;
      select.append(option);
    }
    select.value = width;
    select.addEventListener('change',() => {hiddenSizes[i] = Number(select.value); reset();});
    label.append(select);
    return label;
  }));
  if (!hiddenSizes.length) get('counts').append(element('p','Đầu vào nối thẳng đến đầu ra.','sub'));
}
get('run').addEventListener('click',() => {
  if (timer !== undefined) {stop(); return;}
  get('run').textContent = 'Tạm dừng huấn luyện';
  get('step').disabled = true;
  advance(4);
  timer = setInterval(() => advance(4),180);
});
get('step').addEventListener('click',() => advance(1));
get('reset').addEventListener('click',reset);
get('add').addEventListener('click',() => {hiddenSizes.push(3); renderArchitecture(); reset();});
get('remove').addEventListener('click',() => {hiddenSizes.pop(); renderArchitecture(); reset();});
get('data').addEventListener('change',() => reset({warmText:isText()}));
for (const id of ['activation','noise','xray-task']) get(id).addEventListener('change',reset);
get('noise').addEventListener('input',() => {get('noise-value').value = get('noise').value+'%';});
get('features').addEventListener('change',event => {
  if (!get('features').querySelector(':checked')) {
    event.target.checked = true;
    get('split').textContent = 'Giữ ít nhất một đặc trưng để mạng có đầu vào.';
    return;
  }
  reset();
});
function updateProbe() {
  renderOutput();
  refreshTrace();
  renderSelection();
}
function runCapitalQuestion() {
  stop();
  textProbe = encodeCapital(get('question').value);
  chosenStep = chosenLayer = chosenNeuron = 0;
  renderFrame();
}
get('text-form').addEventListener('submit',event => {
  event.preventDefault();
  runCapitalQuestion();
});
for (const [id,country] of [['example-vn','Việt Nam'],['example-th','Thái Lan']]) {
  get(id).addEventListener('click',() => {
    get('question').value = 'Thủ đô '+country+' là gì?';
    runCapitalQuestion();
  });
}
for (const id of ['x','y']) get(id).addEventListener('input',updateProbe);
get('xray-sample').addEventListener('change',() => {
  stop();
  updateXrayPreview();
  chosenStep = chosenLayer = chosenNeuron = 0;
  updateProbe();
});
map.addEventListener('click',event => {
  if (isXray()) return;
  const bounds = map.getBoundingClientRect();
  get('x').value = (2*(event.clientX-bounds.left)/bounds.width-1).toFixed(2);
  get('y').value = (1-2*(event.clientY-bounds.top)/bounds.height).toFixed(2);
  updateProbe();
});
const tab = document.getElementById('view-neural');
let initialized = false;
const bridge = byId('xray-to-neural');
const fileInput = byId('xrayFile');
function syncBridge() {
  bridge.disabled = Boolean(fileInput.files.length);
  byId('xray-neural-note').textContent = bridge.disabled ? 'Chọn lại một ảnh giả lập để mở trong phòng thí nghiệm.' : 'Dùng một trong ba ảnh giả lập để theo dõi phép tính của mạng.';
}
fileInput.addEventListener('change',syncBridge);
byId('xraySource').addEventListener('change',syncBridge);
bridge.addEventListener('click',() => {
  if (fileInput.files.length) return;
  const sample = byId('xraySource').value;
  const task = imageRun?.wantsGap && !imageRun?.wantsCrack ? 'narrow' : sample === 'narrow' ? 'narrow' : 'crack';
  const reuse = initialized && isXray() && get('xray-task').value === task;
  get('data').value = 'xray';
  get('xray-task').value = task;
  get('xray-sample').value = sample;
  showTab(byId('tab-neural'));
  byId('tab-neural').focus();
  if (reuse) {
    stop();
    updateXrayPreview();
    chosenStep = chosenLayer = chosenNeuron = 0;
    updateProbe();
  } else if (initialized) reset();
});
new MutationObserver(() => {
  if (tab.hidden) stop();
  else if (!initialized) {
    initialized = true;
    renderArchitecture();
    reset();
  }
}).observe(tab,{attributes:true,attributeFilter:['hidden']});
})();
