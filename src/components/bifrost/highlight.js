export function escapeHtml(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function xmlInside(text) {
  return escapeHtml(text).replace(/(&lt;\/?)([A-Za-z_][\w.]*)([^&]*?)(\/?&gt;)/g, (_m, open, tag, attrs, close) =>
    `<span class="text-slate-500">${open}</span><span class="text-pink-300">${tag}</span>` +
    attrs.replace(/([A-Za-z_][\w]*)(=)(\\?")/g, '<span class="text-sky-300">$1</span>$2$3') +
    `<span class="text-slate-500">${close}</span>`);
}

export function highlight(code) {
  const token = /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\b\d+(?:\.\d+)?\b)|([{}\[\],])|(\.\.\.)/g;
  let out = "";
  let last = 0;
  for (const m of String(code).matchAll(token)) {
    out += escapeHtml(code.slice(last, m.index));
    last = m.index + m[0].length;
    const [all, str, colon, num, punct, dots] = m;
    if (str && colon) {
      out += `<span class="text-sky-300">${escapeHtml(str)}</span>${colon}`;
    } else if (str) {
      const inner = str.slice(1, -1);
      const tone = /^@|^\+/.test(inner) ? "text-violet-300"
        : /^0x[0-9a-f]+$/i.test(inner) || /^-?\d+(\.\d+)?$/.test(inner) ? "text-amber-300" : "text-emerald-300";
      out += /<\w/.test(inner)
        ? `<span class="text-emerald-300">"</span>${xmlInside(inner)}<span class="text-emerald-300">"</span>`
        : `<span class="${tone}">${escapeHtml(str)}</span>`;
    } else if (num) {
      out += `<span class="text-amber-300">${num}</span>`;
    } else if (punct || dots) {
      out += `<span class="text-slate-500">${punct || dots}</span>`;
    } else {
      out += escapeHtml(all);
    }
  }
  return out + escapeHtml(String(code).slice(last));
}
