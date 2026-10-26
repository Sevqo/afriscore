// Original AfriCore SVG artwork. Shared geometry and palette; no downloaded or traced assets.
const fs = require('node:fs');
const p = {
  ink: '#172d49',
  orange: '#eea064',
  blue: '#638ac5',
  cyan: '#91d2cd',
  cream: '#f7f3eb',
  skin: '#b97550',
  light: '#d6a07a',
  green: '#37836b',
};
const path = (d, fill = 'none', extra = '') =>
  `<path d="${d}" fill="${fill}" ${extra}/>`;
const rect = (x, y, w, h, fill, rx = 8) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"/>`;
const circle = (x, y, r, fill) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
const line = (x1, y1, x2, y2) =>
  `<path d="M${x1} ${y1}L${x2} ${y2}" fill="none"/>`;
const check = (x, y) =>
  `<g transform="translate(${x} ${y})">${circle(0, 0, 22, p.cyan)}${path('M-10 0L-2 8L12 -9', 'none', 'stroke-width="4"')}</g>`;
function person(
  x,
  y,
  {
    shirt = p.orange,
    skin = p.skin,
    pose = 'desk',
    scale = 1,
    hair = 'curly',
  } = {},
) {
  return `<g transform="translate(${x} ${y}) scale(${scale})">${path('M-28 107L-37 238L-8 238L7 154L18 238H48L35 105Z', p.ink)}${path('M-38 238H-7V251H-54Q-57 243-38 238Z', p.cream)}${path('M18 238H48L62 251H18Z', p.cream)}${path('M-30 47Q-48 60-46 103L-30 127L39 119L38 65Q35 49 17 46Z', shirt)}${rect(-7, 27, 22, 29, skin, 5)}${path('M-26 -4Q-27 -29-4 -35Q22 -39 30 -14L27 17Q22 36 3 37Q-23 34-26 -4Z', skin)}${hair === 'curly' ? path('M-27 1Q-42-13-26-22Q-33-37-18-39Q-8-53 5-41Q21-45 26-31Q42-28 32-12L22-3Q12-11 7-17Q-8-5-27 1Z', p.ink) : path('M-28-6Q-26-40 1-39Q29-36 31-13L25-7Q5-17-9-18L-23-1Z', p.ink)}${path('M-12 7L-8 7M10 7L14 7', 'none', 'stroke-width="3"')}${path('M4 9L1 17H6M-5 24Q3 29 12 22', 'none', 'stroke-width="2"')}${pose === 'carry' ? path('M-34 63Q-53 91-18 106L38 102L40 84L-12 83L-19 63Z', skin) + path('M28 62L57 75L82 58L91 73Q57 108 29 92Z', skin) : pose === 'point' ? path('M-33 63L-48 115L-29 121L-14 74Z', skin) + path('M29 62Q54 85 76 59L90 48L96 58Q65 115 30 94Z', skin) : path('M-34 62Q-57 100-30 118L24 120L28 103L-20 97L-17 74Z', skin) + path('M30 65L56 106L83 105L85 122L42 126L17 87Z', skin)}</g>`;
}
function laptop(x, y, scale = 1) {
  return `<g transform="translate(${x} ${y}) scale(${scale})">${path('M0 0H100L91 69H-10Z', p.blue)}${circle(45, 32, 8, p.cream)}${path('M-21 69H112L104 80H-21Z', p.cream)}</g>`;
}
function document(x, y, w = 120, h = 150) {
  return `<g transform="translate(${x} ${y})">${rect(0, 0, w, h, '#fff', 5)}${line(20, 30, w - 25, 30)}${line(20, 52, w - 35, 52)}${line(20, 80, w - 20, 80)}${line(20, 100, w - 45, 100)}${rect(20, h - 32, 42, 12, p.cyan, 3)}</g>`;
}
function phone(x, y) {
  return `<g transform="translate(${x} ${y})">${rect(0, 0, 52, 92, p.ink, 9)}${rect(6, 9, 40, 66, p.cream, 2)}${circle(26, 83, 3, p.cream)}</g>`;
}
function parcel(x, y, w = 95) {
  return `<g transform="translate(${x} ${y})">${rect(0, 0, w, w * 0.74, p.orange, 4)}${rect(w * 0.43, 0, w * 0.16, w * 0.74, p.cream, 0)}${line(w * 0.15, w * 0.6, w * 0.32, w * 0.6)}</g>`;
}
function shield(x, y) {
  return `<g transform="translate(${x} ${y})">${path('M0-42L38-28V2Q38 31 0 49Q-38 31-38 2V-28Z', p.cyan)}${path('M-18 0L-3 15L21-14', 'none', 'stroke-width="5"')}</g>`;
}
function chart(x, y) {
  return `<g transform="translate(${x} ${y})">${rect(0, 0, 245, 165, '#fff', 9)}${line(25, 135, 225, 135)}${line(25, 30, 25, 135)}${rect(47, 90, 24, 45, p.cyan, 3)}${rect(90, 60, 24, 75, p.blue, 3)}${rect(133, 75, 24, 60, p.orange, 3)}${rect(176, 42, 24, 93, p.cyan, 3)}</g>`;
}
function scene(name, title, content) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 560" fill="none"><title>${title}</title><desc>Original AfriCore conceptual editorial illustration. Educational story, not evidence of a live transaction.</desc><g stroke="${p.ink}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${circle(412, 265, 212, p.cream)}<g stroke="#d8e5df">${circle(412, 265, 232, 'none')}${line(75, 448, 725, 448)}${path('M692 105L700 113L692 121L684 113Z', p.cyan)}${circle(102, 157, 5, p.orange)}${line(656, 401, 670, 401)}</g>${content}</g></svg>`;
  fs.writeFileSync(`website/public/media/editorial/${name}.svg`, svg + '\n');
}
scene(
  'business',
  'Run your business from one workspace',
  `${document(130, 110, 100, 130)}${person(330, 192, { shirt: p.orange })}${rect(210, 350, 405, 92, p.cyan, 7)}${line(245, 442, 245, 478)}${line(577, 442, 577, 478)}${laptop(422, 270)}${phone(255, 263)}${check(601, 172)}${rect(486, 105, 110, 44, '#fff', 8)}${line(504, 123, 564, 123)}${line(504, 137, 547, 137)}`,
);
scene(
  'payments',
  'Customer and merchant connect through a verified payment',
  `${person(205, 174, { shirt: p.blue, skin: p.light, pose: 'point', hair: 'short' })}${person(574, 174, { shirt: p.orange, pose: 'carry' })}${phone(365, 244)}${path('M300 238Q353 147 488 224', 'none', 'stroke-dasharray="8 8"')}${check(402, 155)}${rect(490, 342, 180, 100, p.cyan, 5)}${parcel(530, 295, 75)}`,
);
scene(
  'reconciliation',
  'Match incoming payments to their invoice records',
  `${person(176, 194, { shirt: p.cyan, pose: 'point' })}${document(347, 130, 110, 140)}${document(540, 230, 110, 140)}${rect(332, 326, 130, 55, p.blue, 7)}${rect(533, 117, 132, 55, p.orange, 7)}${path('M462 354Q510 354 515 299H540', 'none', 'stroke-dasharray="6 6"')}${path('M533 145H479V201H457', 'none', 'stroke-dasharray="6 6"')}${check(455, 270)}${check(652, 371)}`,
);
scene(
  'invoicing',
  'A contractor prepares an invoice and follows its timeline',
  `${person(184, 192, { shirt: p.orange, pose: 'point', hair: 'short' })}${path('M151 163Q179 117 214 161Z', p.orange)}${document(330, 116, 163, 215)}${person(620, 231, { shirt: p.blue, skin: p.light, scale: 0.78 })}${path('M499 187Q568 146 613 195', 'none', 'stroke-dasharray="7 7"')}${line(340, 385, 570, 385)}${circle(350, 385, 8, p.orange)}${circle(455, 385, 8, p.cyan)}${circle(561, 385, 8, p.blue)}${line(351, 406, 383, 406)}${line(442, 406, 477, 406)}${line(544, 406, 579, 406)}`,
);
scene(
  'cashflow',
  'Review recorded money movement and upcoming obligations',
  `${chart(363, 120)}${person(219, 190, { shirt: p.orange, pose: 'point', skin: p.light })}${document(435, 332, 110, 118)}${rect(567, 320, 96, 85, p.cyan, 6)}${line(585, 346, 644, 346)}${line(585, 365, 628, 365)}${circle(354, 379, 26, p.orange)}${line(354, 361, 354, 397)}${path('M364 368Q343 361 344 375Q345 381 358 382Q370 388 348 394')}`,
);
scene(
  'protected-payments',
  'A courier and buyer inspect a delivery',
  `${person(201, 188, { shirt: p.cyan, pose: 'carry', hair: 'short' })}${path('M169 158Q180 133 209 145L226 164H166Z', p.blue)}${person(586, 190, { shirt: p.orange, skin: p.light, pose: 'point' })}${parcel(330, 278, 133)}${shield(417, 148)}${document(498, 295, 72, 100)}${path('M269 381Q313 415 345 390', 'none', 'stroke-dasharray="6 6"')}${line(461, 407, 507, 407)}`,
);
scene(
  'integrations',
  'Connect business systems through a shared service',
  `${rect(337, 207, 128, 125, p.cyan, 20)}${path('M365 296L400 243L436 296M377 278H425', 'none', 'stroke-width="8"')}${path('M337 248H230V182M465 249H572V174M373 332V390H240M435 332V394H563', 'none', 'stroke-dasharray="7 7"')}${laptop(150, 115, 0.85)}${parcel(550, 119, 95)}${document(168, 347, 91, 116)}${rect(535, 353, 125, 90, p.blue, 6)}${path('M530 353L545 332H650L666 353Z', p.orange)}${rect(554, 378, 28, 65, p.cream, 2)}${rect(599, 375, 42, 34, p.cyan, 2)}`,
);
scene(
  'automation',
  'Routine reminders follow a controlled sequence',
  `${person(254, 194, { shirt: p.blue, pose: 'desk' })}${laptop(324, 307)}${rect(145, 386, 336, 49, p.orange, 5)}${line(177, 435, 177, 478)}${line(446, 435, 446, 478)}${document(496, 121, 105, 120)}${rect(539, 301, 116, 79, p.cyan, 8)}${path('M563 329H628M563 348H609')}${path('M419 229H464V180H496M550 241V301', 'none', 'stroke-dasharray="7 7"')}${check(622, 139)}${circle(427, 229, 9, p.orange)}`,
);
scene(
  'developers',
  'A developer builds on connected business APIs',
  `${person(226, 191, { shirt: p.orange, pose: 'desk', hair: 'short' })}${laptop(305, 298, 1.2)}${rect(143, 394, 346, 42, p.cyan, 5)}${line(171, 436, 171, 475)}${line(457, 436, 457, 475)}${rect(492, 114, 146, 97, p.blue, 10)}${path('M532 143L515 161L532 179M595 143L612 161L595 179M575 139L552 183', 'none', 'stroke="#fff" stroke-width="4"')}${rect(545, 291, 94, 78, p.cream, 7)}${line(563, 315, 620, 315)}${line(563, 338, 607, 338)}${path('M490 162H447V276M565 211V291', 'none', 'stroke-dasharray="7 7"')}`,
);
scene(
  'education',
  'Two colleagues make sense of a financial report',
  `${person(202, 198, { shirt: p.blue, skin: p.light, pose: 'point' })}${person(594, 199, { shirt: p.orange, pose: 'carry', hair: 'short' })}${chart(316, 127)}${rect(285, 375, 287, 62, p.cyan, 7)}${line(311, 437, 311, 481)}${line(546, 437, 546, 481)}${document(379, 314, 91, 114)}${circle(149, 115, 26, p.cream)}${path('M145 108Q156 100 158 111Q159 118 149 122M149 131V132', 'none', 'stroke-width="3"')}`,
);

scene('passport','A business owner presents a private business passport',`${person(226,190,{shirt:p.orange,pose:'point'})}${rect(370,128,240,280,p.cyan,16)}${document(400,165,170,200)}${circle(441,214,22,p.skin)}${line(480,205,550,205)}${line(480,226,537,226)}${shield(590,330)}`);
scene('credential-issuance','A reviewed issuer delivers a signed minimal credential',`${person(190,195,{shirt:p.blue,pose:'point'})}${person(600,195,{shirt:p.orange,skin:p.light,pose:'carry'})}${document(325,175,145,190)}${check(432,308)}${path('M263 240H313M480 240H530','none','stroke-dasharray="7 7"')}`);
scene('trust-network','Commercial counterparties choose a confirmed relationship',`${person(190,205,{shirt:p.orange,pose:'point'})}${person(585,205,{shirt:p.cyan,skin:p.light,pose:'point'})}${parcel(340,295,105)}${path('M270 215Q400 95 525 215M270 365Q400 460 525 365','none','stroke-dasharray="8 8"')}${shield(400,170)}`);
scene('privacy','A business owner chooses the records to disclose',`${person(245,195,{shirt:p.blue,pose:'desk'})}${laptop(325,305)}${document(490,133,110,135)}${shield(540,342)}${path('M430 244H470V200H490','none','stroke-dasharray="7 7"')}${rect(171,395,310,35,p.orange,4)}`);
scene('verification','A verifier inspects a signed business credential',`${person(235,195,{shirt:p.cyan,pose:'point'})}${document(380,137,190,255)}${circle(542,330,48,p.cream)}${line(578,366,622,410)}${check(541,330)}${line(405,200,530,200)}`);
scene('anchoring','Private credential commitments join a shared root',`${document(145,157,100,130)}${document(145,320,100,130)}${rect(365,245,105,105,p.cyan,12)}${shield(610,286)}${path('M245 220H312V280H365M245 380H312V320H365M470 296H560','none','stroke-dasharray="7 7"')}${circle(415,297,20,p.blue)}`);
scene('credibility','A growing business maintains an evidence history',`${person(238,190,{shirt:p.orange,pose:'carry'})}${chart(369,130)}${document(425,320,85,110)}${parcel(530,345,85)}${check(574,185)}`);
console.log('Created 17 original editable AfriCore editorial SVG scenes.');
