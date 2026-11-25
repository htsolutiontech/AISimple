'use strict';

(() => {
  const records = [
    {name:'Báo Sài Gòn Giải Phóng',url:'https://www.sggp.org.vn/',type:'Trang chủ'},
    {name:'Thông tin Báo SGGP',url:'https://www.sggp.org.vn/thongtinsggp/',type:'Trang giới thiệu'}
  ];
  const domain = 'www.sggp.org.vn';
  const stages = ['Nhận câu hỏi','Nhận diện yêu cầu','Tra cứu nguồn','Chấm điểm','Trả lời'];
  const input = byId('lookup-query');
  const evidence = byId('lookup-evidence');
  const section = byId('view-website');
  const playback = createPlayback('lookup-playback',render);
  const nodes = stages.map((name,index) => {
    const button = element('button',name);
    button.type = 'button';
    button.addEventListener('click',() => {
      playback.jump(index);
      render(index);
    });
    byId('lookup-path').append(button);
    return button;
  });
  let ranking;
  let supported;

  function normalize(text) {
    return words(text.normalize('NFC')).join(' ').normalize('NFD').replace(/\p{M}/gu,'').replaceAll('đ','d');
  }
  function namesPaper(text) {
    return /\b(?:sggp|sai gon giai phong)\b/.test(normalize(text));
  }
  function score(record) {
    const name = namesPaper(record.name) ? 3 : 0;
    const host = new URL(record.url).hostname === domain ? 2 : 0;
    const homepage = record.type === 'Trang chủ' ? 2 : 0;
    return {...record,namePoints:name,hostPoints:host,homePoints:homepage,total:name+host+homepage};
  }
  function websiteLink(record) {
    const link = element('a',record.url);
    link.href = record.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    return link;
  }
  function render(index) {
    nodes.forEach((node,i) => {
      node.hidden = !supported && i > 1;
      if (i === index) node.setAttribute('aria-current','step');
      else node.removeAttribute('aria-current');
    });
    evidence.hidden = index < 2;
    evidence.replaceChildren();
    if (index < 2) return;
    if (index === 4) {
      evidence.append(element('strong','Trang web của Báo Sài Gòn Giải Phóng'),websiteLink(ranking[0]),element('p','Nguồn đối chiếu tên và đơn vị xuất bản','sub'),websiteLink(records[1]));
      return;
    }
    evidence.append(element('strong',index === 2 ? 'Nguồn tìm thấy trong danh mục' : 'So sánh điểm của từng nguồn'));
    for (const record of ranking) {
      const row = element('div','','lookup-source');
      row.append(element('strong',record.type+' · '+record.name),websiteLink(record));
      if (index === 3) row.append(element('p','Tên báo +'+record.namePoints+' · Tên miền +'+record.hostPoints+' · Trang chủ +'+record.homePoints+' = '+record.total+' điểm.','sub'));
      evidence.append(row);
    }
  }
  function run({autoplay = false} = {}) {
    const question = input.value.trim();
    const intent = /\b(?:trang web|website|trang chu|dia chi|link|url)\b/.test(normalize(question));
    supported = intent && namesPaper(question);
    ranking = supported ? records.map(score).sort((a,b) => b.total-a.total) : [];
    const steps = [
      ['Nhận câu hỏi','“'+question+'”','Đưa về chữ thường và tách từ.','Từ đã tách: '+words(question.normalize('NFC')).join(' · ')+'.'],
      ['Nhận diện yêu cầu',normalize(question),'Kiểm tra cụm “trang web” hoặc từ tương đương và nhận dạng SGGP / Sài Gòn Giải Phóng.',supported ? 'Cần tìm trang chủ của Báo Sài Gòn Giải Phóng.' : 'Câu hỏi nằm ngoài danh mục. Hãy thử hỏi trang web của báo SGGP.']
    ];
    if (supported) steps.push(
      ['Tra cứu nguồn','Tên báo đã nhận diện.','Lọc theo tên báo trong danh mục đã cài sẵn.','Tìm thấy '+ranking.length+' nguồn: trang chủ và trang giới thiệu.'],
      ['Chấm điểm',ranking.length+' nguồn ứng viên.','Cộng 3 nếu khớp tên báo, 2 nếu khớp tên miền đã ghi nhận, 2 nếu là trang chủ.',ranking.map(record => record.type+' '+record.total+' điểm').join(' · ')+'.'],
      ['Trả lời','Nguồn đứng đầu: '+ranking[0].type+'.','Lấy URL từ bản ghi đứng đầu và đính kèm trang giới thiệu để đối chiếu.','Trang web của Báo Sài Gòn Giải Phóng là '+ranking[0].url]
    );
    playback.load(steps,0,{autoplay});
    render(0);
  }

  byId('lookup-form').addEventListener('submit',event => {
    event.preventDefault();
    if (!input.value.trim()) {input.focus();return;}
    run({autoplay:true});
  });
  byId('prompt-to-lookup').addEventListener('click',() => {
    const data = byId('nl-data');
    data.value = 'website';
    showTab(byId('tab-neural'));
    data.dispatchEvent(new Event('change'));
    input.focus();
  });
  new MutationObserver(() => {
    if (!section.hidden) return;
    playback.jump(0);
    render(0);
  }).observe(section,{attributes:true,attributeFilter:['hidden']});
  run();
})();
