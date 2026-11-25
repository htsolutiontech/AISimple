'use strict';

function createPlayback(hostId, onSelect) {
  const host = document.getElementById(hostId);
  const panel = host.closest('[role=tabpanel]');
  const make = (tag, content, className) => {
    const node = document.createElement(tag);
    node.textContent = content;
    if (className) node.className = className;
    return node;
  };
  const playback = make('section', '', 'playback');
  const controls = make('div', '', 'playback-controls');
  const play = make('button', 'Tự động phát', 'play-button');
  const back = make('button', 'Lùi một bước');
  const next = make('button', 'Tiến một bước');
  for (const button of [play, back, next]) button.type = 'button';
  const speed = make('select', '');
  speed.setAttribute('aria-label', 'Thời gian mỗi bước');
  for (const [time, label] of [[2000, 'Nhanh · 2 giây'], [4500, 'Vừa · 4,5 giây'], [7500, 'Chậm · 7,5 giây']]) {
    const item = make('option', label);
    item.value = time;
    speed.append(item);
  }
  speed.value = 4500;
  const progress = make('progress', '');
  progress.setAttribute('aria-label', 'Tiến độ mô phỏng');
  const marker = make('span', '', 'playback-position');
  const heading = make('strong', '');
  const measurement = make('div', '', 'transfer-items');
  for (const title of ['Dữ liệu vào', 'Đang xử lý', 'Dữ liệu ra']) {
    const tile = make('div', '', 'transfer-item');
    tile.append(make('span', title), make('p', ''));
    measurement.append(tile);
  }
  const detail = make('div', '', 'transfer-detail');
  detail.setAttribute('aria-live', 'polite');
  detail.append(heading, measurement);
  controls.append(play, back, next, speed, marker);
  playback.append(controls, progress, detail);
  host.append(playback);

  let steps = [];
  let current = 0;
  let timer;
  let playing = false;

  function pause() {
    clearTimeout(timer);
    playing = false;
    play.textContent = current === steps.length - 1 ? 'Phát lại từ đầu' : 'Tự động phát';
  }
  function setStep(index) {
    current = index;
    const [label, input, action, output] = steps[index];
    progress.max = steps.length;
    progress.value = index + 1;
    marker.textContent = 'Bước '+(index + 1)+' / '+steps.length;
    heading.textContent = label;
    [input, action, output].forEach((value, i) => {
      measurement.children[i].lastElementChild.textContent = value;
    });
    back.disabled = index === 0;
    next.disabled = index === steps.length - 1;
    playback.dataset.step = index;
    play.textContent = playing ? 'Tạm dừng' : (next.disabled ? 'Phát lại từ đầu' : 'Tự động phát');
    playback.getAnimations({subtree:true}).forEach(animation => animation.cancel());
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      [...measurement.children].forEach((tile, i) => {
        tile.animate([{opacity:.55, transform:'translateX(-4px)'},{opacity:1, transform:'translateX(0)'}],
          {duration:300, delay:i*100});
      });
    }
  }
  function select(index) {
    setStep(index);
    onSelect(index);
  }
  function schedule() {
    clearTimeout(timer);
    if (current === steps.length - 1) {
      pause();
      return;
    }
    timer = setTimeout(() => {
      select(current + 1);
      schedule();
    }, Number(speed.value));
  }
  play.addEventListener('click', () => {
    if (playing) { pause(); return; }
    playing = true;
    select(current === steps.length - 1 ? 0 : current);
    schedule();
  });
  back.addEventListener('click', () => { pause(); select(current - 1); });
  next.addEventListener('click', () => { pause(); select(current + 1); });
  speed.addEventListener('change', () => { if (playing) schedule(); });
  new MutationObserver(() => { if (panel.hidden) pause(); }).observe(panel, {attributes:true, attributeFilter:['hidden']});

  return {
    load(newSteps, index = 0, {autoplay = false} = {}) {
      pause();
      steps = newSteps;
      playing = autoplay;
      setStep(index);
      if (playing) schedule();
    },
    jump(index) {
      pause();
      setStep(index);
    }
  };
}
