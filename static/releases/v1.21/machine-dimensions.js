/* Reference facts from operation manuals pp.13–14. Not per-part manufacturing tolerances.
 * 50 SHA256: 993d5d4b5a4ad24a19e268341790ecaae7186b9dca1d67e4c206e63f883769b6
 * 60 SHA256: 1183cb581772d5113a097f43f09285318221049952589a0df4484a49249e7d2e
 */
(function(root){
 'use strict';
 const refs=Object.freeze({'50':Object.freeze({screw:49.7,intermeshing:49.5,barrel:50.0}),'60':Object.freeze({screw:59.6,intermeshing:59.4,barrel:60.0})});
 function libraryNote(machine){const r=refs[machine];if(!r)return '';return `<div class="library-diameter-note" data-diameter-machine="${machine}"><strong>${machine}机专用元件库 · 不可与${machine==='50'?'60':'50'}机混用</strong><span>手册参考直径：螺杆 <b>Ø${r.screw} mm</b> · 啮合螺纹块 <b>Ø${r.intermeshing} mm</b></span><small>机筒直径参考 Ø${r.barrel.toFixed(1)} mm。“${machine}”是机型尺寸规格，不是每块元件的实测外径。单型号公差按制造图纸核对。</small></div>`}
 root.MachineDimensions={refs,libraryNote};
})(globalThis);
