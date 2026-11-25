(() => {
const datasets = {
  balanced: [[1100,7,0],[1900,14,0],[2600,9,0],[2800,19,0],[3600,13,0],[4100,23,0],[4800,16,0],[7200,31,1],[6500,35,1],[7700,42,1],[6800,48,1],[8300,52,1],[8800,41,1],[9300,55,1]],
  overlap: [[1100,7,0],[1900,14,0],[2600,9,0],[2800,19,0],[4100,23,0],[6300,26,0],[6800,48,0],[4100,33,1],[5200,22,1],[5500,29,1],[6500,35,1],[7700,42,1],[8300,52,1],[9300,55,1]],
  biased: [[1100,7,0],[1900,14,0],[2600,9,0],[2800,19,0],[3600,13,0],[4100,23,0],[4800,16,0],[5900,23,0],[6300,27,0],[7000,32,0],[8300,52,1],[9300,55,1]]
};
const labels = ['Ngồi nhiều','Vận động nhiều'];
const colors = ['#087865','#6c45b5'];
const fills = ['#e3f4ee','#efe9f8'];
const byId = (id) => document.getElementById(id);
const chart = byId('chart');
const trainingPlayback = createPlayback('trainingPlayback', (index) => {
  chart.dataset.traceStep = index;
});
const dataset = byId('dataset');
const stepInput = byId('steps');
const minuteInput = byId('minutes');
const train = byId('train');
const undo = byId('undo');
const addAtTest = byId('addAtTest');
const number = new Intl.NumberFormat('vi-VN');
const frame = {left:65, top:18, width:517, height:326};
const left = frame.left;
const top = frame.top;
const bottom = top + frame.height;
let examples;
let model;
let mode;
let query;
let baseCount;
let dirty;
let previousModel;
function reset({preserveQuery = false} = {}) {
  examples = datasets[dataset.value].slice();
  baseCount = examples.length;
  model = null;
  previousModel = null;
  dirty = false;
  if (!preserveQuery) query = [5500, 25];
  setMode('test');
  render();
}
function predict(trained, point) {
  const nearest = trained.map(([steps, minutes, label]) => ({
    steps, minutes, label,
    distance: ((steps - point[0]) / 10000) ** 2 + ((minutes - point[1]) / 60) ** 2
  })).sort((a, b) => a.distance - b.distance).slice(0, 3);
  const active = nearest.filter((example) => example.label === 1).length;
  return {nearest, active, label: Number(active >= 2)};
}
function xAt(steps) { return left + steps * frame.width / 10000; }
function yAt(minutes) { return bottom - minutes * frame.height / 60; }
function point(x, y, label) {
  const style = 'fill="' + colors[label] + '" stroke="white" stroke-width="2"';
  if (label === 0) return '<circle cx="'+x+'" cy="'+y+'" r="6.5" '+style+'/>';
  return '<rect x="'+(x-5.7)+'" y="'+(y-5.7)+'" width="11.4" height="11.4" rx="1.4" transform="rotate(45 '+x+' '+y+')" '+style+'/>';
}
let background = '';
let grid = '';
function buildBackground() {
  background = '<rect x="'+left+'" y="'+top+'" width="'+frame.width+'" height="'+frame.height+'" fill="#fff"/>';
  if (model) {
    const columns = 50;
    const rows = 32;
    const width = frame.width / columns;
    const height = frame.height / rows;
    const paths = ['', ''];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const {label} = predict(model, [(col + .5) * 10000 / columns, (rows - row - .5) * 60 / rows]);
        const x = left + col * width;
        const y = top + row * height;
        paths[label] += 'M'+x.toFixed(2)+' '+y.toFixed(2)+'h'+(width+.02).toFixed(2)+'v'+(height+.02).toFixed(2)+'h-'+(width+.02).toFixed(2)+'Z';
      }
    }
    background += paths.map((path, i) => '<path d="'+path+'" fill="'+fills[i]+'"/>').join('');
  }
}
for (let steps = 0; steps <= 10000; steps += 2000) {
  const x = xAt(steps);
  grid += '<path d="M'+x+' '+top+'V'+bottom+'" stroke="#c8d9dc" stroke-opacity=".75"/><text x="'+x+'" y="367" text-anchor="middle">'+number.format(steps)+'</text>';
}
for (let minutes = 0; minutes <= 60; minutes += 15) {
  const y = yAt(minutes);
  grid += '<path d="M'+left+' '+y+'H582" stroke="#c8d9dc" stroke-opacity=".75"/><text x="55" y="'+(y+5)+'" text-anchor="end">'+minutes+'</text>';
}
grid += '<text x="324" y="393" text-anchor="middle" font-weight="650">Số bước đi</text><text x="18" y="183" text-anchor="middle" transform="rotate(-90 18 183)" font-weight="650">Phút vận động</text>';
function draw(prediction) {
  const x = xAt(query[0]);
  const y = yAt(query[1]);
  const links = prediction ? prediction.nearest.map((example) =>
    '<line x1="'+x+'" y1="'+y+'" x2="'+xAt(example.steps)+'" y2="'+yAt(example.minutes)+'" stroke="'+colors[example.label]+'" stroke-width="2" stroke-dasharray="4 4"/>'
  ).join('') : '';
  const rings = prediction ? prediction.nearest.map((example) =>
    '<circle cx="'+xAt(example.steps)+'" cy="'+yAt(example.minutes)+'" r="11" fill="none" stroke="'+colors[example.label]+'" stroke-width="1.5"/>'
  ).join('') : '';
  const markers = examples.map(([steps, minutes, label]) => point(xAt(steps), yAt(minutes), label)).join('');
  chart.innerHTML = '<title id="chart-title">Biểu đồ số bước đi và số phút vận động</title><desc id="chart-desc">'+examples.length+' ví dụ. Ngày thử có '+number.format(query[0])+' bước và '+query[1]+' phút vận động. Có thể điều chỉnh ngày thử bằng hai thanh trượt.</desc>'+background+'<g fill="#405969" font-size="15">'+grid+'</g>'+links+markers+rings+'<rect x="'+(x-7)+'" y="'+(y-7)+'" width="14" height="14" rx="2" fill="#f0bf52" stroke="#152635" stroke-width="2.5"/>';
}
function setMode(next) {
  mode = next;
  for (const button of document.querySelectorAll('[data-mode]')) {
    const selected = button.dataset.mode === mode;
    button.setAttribute('aria-pressed', selected);
    button.classList.toggle('selected', selected);
  }
  addAtTest.hidden = mode === 'test';
}
function renderTrainingTrace(prediction) {
  const queryText = number.format(query[0])+' bước · '+query[1]+' phút';
  const normalized = '['+number.format(query[0]/10000)+' · '+number.format(Math.round(query[1]/60*1000)/1000)+']';
  const stages = [
    ['Nhận ngày thử', queryText, 'Lấy số bước và số phút từ hai thanh trượt.', 'Hai thông số của ngày thử: '+queryText+'.'],
    ['Đưa về cùng thang đo', queryText, 'Chia số bước cho 10.000 và số phút cho 60.', 'Hai giá trị trong khoảng 0 đến 1: '+normalized+'.']
  ];
  if (prediction) {
    const closest = prediction.nearest.map(({label,distance}) => labels[label]+' ('+number.format(Math.round(Math.sqrt(distance)*1000)/1000)+')').join(' · ');
    stages.push(
      ['Tìm 3 ngày gần nhất', normalized+' và '+model.length+' ví dụ đã lưu.', 'Tính khoảng cách đến từng ví dụ và giữ lại 3 khoảng cách nhỏ nhất.', closest+'.'],
      ['Bỏ phiếu theo nhãn', closest+'.', (3-prediction.active)+' phiếu ngồi nhiều và '+prediction.active+' phiếu vận động nhiều.', 'Dự đoán “'+labels[prediction.label]+'” cho '+queryText+'.']
    );
  } else {
    stages.push(['Chuẩn bị bộ ví dụ', examples.length+' ví dụ đã gắn nhãn.', 'Bấm Huấn luyện để mô hình KNN ghi nhớ bộ ví dụ hiện tại.', 'Sau khi huấn luyện, luồng sẽ có thêm bước tìm láng giềng và bỏ phiếu.']);
  }
  chart.dataset.traceStep = '0';
  trainingPlayback.load(stages);
}
function render({refreshBackground = true} = {}) {
  const active = examples.filter((example) => example[2] === 1).length;
  const prediction = model ? predict(model, query) : null;
  byId('counts').textContent = (examples.length - active)+' ngồi nhiều · '+active+' vận động nhiều';
  byId('status').textContent = dirty ? 'Dữ liệu đã đổi. Huấn luyện lại để dùng các ví dụ hiện tại.' : model ? 'Mô hình đã ghi nhớ '+model.length+' ví dụ. Màu nền cho biết vùng dự đoán.' : 'Bấm Huấn luyện để mô hình ghi nhớ '+examples.length+' ví dụ.';
  train.textContent = model || dirty ? 'Huấn luyện lại' : 'Huấn luyện';
  undo.disabled = examples.length === baseCount;
  stepInput.value = query[0];
  minuteInput.value = query[1];
  byId('stepValue').textContent = number.format(query[0]);
  byId('minuteValue').textContent = query[1] + ' phút';
  const result = byId('result');
  const neighborDetail = byId('neighbor-detail');
  neighborDetail.hidden = !prediction;
  if (prediction) {
    const neighbors = prediction.nearest.map((example) => {
      const row = document.createElement('li');
      row.textContent = number.format(example.steps)+' bước · '+example.minutes+' phút · '+labels[example.label]+' · khoảng cách '+number.format(Math.round(Math.sqrt(example.distance)*1000)/1000);
      return row;
    });
    byId('neighbor-list').replaceChildren(...neighbors);
    result.dataset.label = prediction.label;
    result.innerHTML = '<strong>'+labels[prediction.label]+'</strong><p>'+prediction.active+'/3 vận động nhiều · '+(3-prediction.active)+'/3 ngồi nhiều</p>';
    if (previousModel) {
      const previous = predict(previousModel, query);
      const note = document.createElement('p');
      note.textContent = 'Với cùng ngày thử, mô hình trước dự đoán “'+labels[previous.label]+'” ('+previous.active+'/3 phiếu vận động nhiều).';
      result.append(note);
    }
  } else {
    delete result.dataset.label;
    result.innerHTML = '<strong>Chưa có dự đoán</strong><p>Huấn luyện mô hình, rồi kéo hai thanh trượt để thử.</p>';
  }
  if (refreshBackground) buildBackground();
  draw(prediction);
  renderTrainingTrace(prediction);
}
function addExample(location) {
  examples.push([...location, Number(mode)]);
  if (model) previousModel = model;
  dirty = model !== null || dirty;
  model = null;
  render();
}
for (const button of document.querySelectorAll('[data-mode]')) {
  button.addEventListener('click', () => setMode(button.dataset.mode));
}
dataset.addEventListener('change', () => reset({preserveQuery: true}));
byId('reset').addEventListener('click', () => {dataset.value = 'balanced'; reset();});
undo.addEventListener('click', () => {
  examples.pop();
  if (model) previousModel = model;
  dirty = model !== null || dirty;
  model = null;
  render();
});
addAtTest.addEventListener('click', () => addExample(query));
train.addEventListener('click', () => {
  model = examples.slice();
  dirty = false;
  render();
});
for (const input of [stepInput, minuteInput]) {
  input.addEventListener('input', () => {
    query = [Number(stepInput.value), Number(minuteInput.value)];
    render({refreshBackground: false});
  });
}
chart.addEventListener('click', (event) => {
  const transform = chart.getScreenCTM();
  if (!transform) return;
  const local = new DOMPoint(event.clientX, event.clientY).matrixTransform(transform.inverse());
  if (local.x < left || local.x > left + frame.width || local.y < top || local.y > bottom) return;
  const location = [Math.round((local.x - left) / frame.width * 100) * 100, Math.round((bottom - local.y) / frame.height * 60)];
  if (mode === 'test') {
    query = location;
    render({refreshBackground: false});
  } else {
    addExample(location);
  }
});
reset();
})();
