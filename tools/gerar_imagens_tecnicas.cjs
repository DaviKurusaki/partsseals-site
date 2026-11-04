const fs = require('node:fs');
const path = require('node:path');

// Geometrias editoriais genericas: nao representam cotas ou um codigo de produto.
const perfis = {
  'perfil-gaxeta': '<path d="M160 690V310h125v255h235V310h125v380H160Z"/><path class="vazio" d="M285 310v255h235V310"/>',
  'perfil-raspador': '<path d="M145 690V485h150l82-182 93 40-64 142h250v205H145Z"/><path class="detalhe" d="M295 485h111M377 303l93 40"/>',
  'perfil-anel-guia': '<path d="M175 310h425l80 80v230l-80 80H175l-65-80V390l65-80Z"/><path class="vazio" d="M215 400h320l55 45v120l-55 45H215l-20-45V445l20-45Z"/>',
  'perfil-dp-dh': '<path d="M115 690V560h95l70-270h100l55 270 70-270h100l70 270h95v130H115Z"/><path class="detalhe" d="M280 290h100m125 0h100"/>',
  'perfil-backup': '<path d="M140 690V405l122-95h335l63 95v285H140Z"/><path class="vazio" d="M260 410h260l45 55v135H240V465l20-55Z"/>',
  'perfil-compacta': '<path d="M130 690V340h120v225h96V290h120v275h95V340h120v350H130Z"/><path class="detalhe" d="M250 340v225m216-275v275m95-225v225"/>',
  'perfil-peca-tecnica': '<path d="M130 690V480h115V350h135V255h170v95h135v130h115v210H130Z"/><path class="vazio" d="M330 480h270v140H330V480Z"/>',
  'perfil-amostra': '<path d="M155 690V565h100l75-225h225l80 225h95v125H155Z"/><path class="vazio" d="M350 440h185l35 125H315l35-125Z"/><path class="detalhe" d="M125 725h620"/>'
};

const destino = path.join(__dirname, '..', 'assets', 'img', 'perfis');
fs.mkdirSync(destino, { recursive: true });

for (const [nome, desenho] of Object.entries(perfis)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 933" role="img">
  <defs>
    <pattern id="grade" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="#dbe1e5" stroke-width="1"/></pattern>
    <pattern id="corte" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="14" height="14" fill="#ba1022"/><path d="M0 0V14" stroke="#e97982" stroke-width="3"/></pattern>
    <filter id="sombra" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="18" stdDeviation="20" flood-color="#293139" flood-opacity=".14"/></filter>
  </defs>
  <rect width="1400" height="933" fill="#e9edf0"/>
  <rect x="34" y="34" width="1332" height="865" rx="18" fill="#fafbfb" stroke="#c7d0d6" stroke-width="2"/>
  <path d="M34 114h1332" stroke="#b9c4cb" stroke-width="2"/>
  <path d="M76 72h194" stroke="#c8102e" stroke-width="12" stroke-linecap="square"/>
  <circle cx="1313" cy="74" r="11" fill="#c8102e"/>
  <rect x="34" y="115" width="1332" height="784" fill="url(#grade)"/>
  <path d="M700 155v700M100 505h1200" stroke="#b6c2c9" stroke-width="2" stroke-dasharray="12 14"/>
  <g transform="translate(280 30)" fill="url(#corte)" stroke="#941323" stroke-width="7" stroke-linejoin="round" filter="url(#sombra)">${desenho}</g>
  <path d="M147 838h210m-210-22v44m210-44v44M1043 838h210m-210-22v44m210-44v44" stroke="#879aa4" stroke-width="3"/>
  <style>.vazio{fill:#fafbfb;stroke:#941323}.detalhe{fill:none;stroke:#941323;stroke-width:8;stroke-linecap:round}</style>
</svg>\n`;
  fs.writeFileSync(path.join(destino, `${nome}.svg`), svg);
}
