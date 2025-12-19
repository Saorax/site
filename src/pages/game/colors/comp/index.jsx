import "../../../../styles/global.css";
import { host } from "../../../../stuff";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import UPNG from "upng-js";
import GIF from "gif.js.optimized";
import gifWorkerUrl from "gif.js.optimized/dist/gif.worker.js?url";
import { ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/20/solid";
import "../../../../../fonts/style.css";

function normalizeText(value) {
  if (!value) return "";
  return value
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function defineToCssColor(value) {
  if (value == null) return null;

  if (typeof value === "number" && Number.isFinite(value)) {
    const rgb = value & 0xffffff;
    return `#${rgb.toString(16).padStart(6, "0")}`;
  }

  const str = value.toString().trim();

  const m0x = str.match(/^0x([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/i);
  if (m0x) {
    const hex = m0x[1];
    const rgb = hex.length === 8 ? hex.slice(2) : hex;
    return `#${rgb.toLowerCase()}`;
  }

  const mh = str.match(/^#?([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
  if (mh) {
    const hex = mh[1];
    const rgb = hex.length === 8 ? hex.slice(2) : hex;
    return `#${rgb.toLowerCase()}`;
  }

  return null;
}

function normalizeDefineValue(v) {
  if (v == null) return null;
  const s = v.toString().trim();

  const m0x = s.match(/^0x([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/i);
  if (m0x) {
    const hex = m0x[1];
    const rgb = (hex.length === 8 ? hex.slice(2) : hex).toLowerCase();
    return `0x${rgb}`;
  }

  const mh = s.match(/^#?([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
  if (mh) {
    const hex = mh[1];
    const rgb = (hex.length === 8 ? hex.slice(2) : hex).toLowerCase();
    return `0x${rgb}`;
  }

  return s;
}



function cssToDefine(value) {
  if (!value) return null;
  const hex = value.replace("#", "").toLowerCase();
  if (!/^[0-9a-f]{6}$/.test(hex)) return null;
  return `0x${hex}`;
}

function applyDefinesToSvg(svg, defineColorMap) {
  if (!svg || !defineColorMap) return svg;
  try {
    if (typeof DOMParser === "undefined") return svg;
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, "image/svg+xml");
    if (doc.getElementsByTagName("parsererror")[0]) return svg;

    Object.entries(defineColorMap).forEach(([defineKey, cssColor]) => {
      if (!cssColor) return;
      const nodes = doc.querySelectorAll(`[data-define="${defineKey}"]`);
      nodes.forEach((node) => {
        const tag = node.tagName ? node.tagName.toLowerCase() : "";
        if (tag === "stop") node.setAttribute("stop-color", cssColor);
        else node.setAttribute("fill", cssColor);
      });
    });

    return new XMLSerializer().serializeToString(doc.documentElement);
  } catch (err) {
    console.error("applyDefinesToSvg error", err);
    return svg;
  }
}

function buildDefineColorMap(defineEntries) {
  if (!defineEntries || !defineEntries.length) return null;
  const map = {};
  defineEntries.forEach(({ key, cssColor }) => {
    if (!cssColor) return;
    map[key] = cssColor;
  });
  return map;
}

function processFramesWithDefines(frames, defineColorMap) {
  if (!frames || !Array.isArray(frames) || !defineColorMap) return frames;
  return frames.map((frame) => {
    const baseSvg =
      typeof frame === "string"
        ? frame
        : frame && typeof frame.svg === "string"
          ? frame.svg
          : null;
    if (!baseSvg) return frame;
    const coloredSvg = applyDefinesToSvg(baseSvg, defineColorMap);
    if (typeof frame === "string") return coloredSvg;
    return { ...frame, svg: coloredSvg };
  });
}

function normalizeCssToHex(css) {
  if (!css) return null;
  const s = css.toString().trim();
  if (!s) return null;
  if (s[0] === "#") {
    const hex = s.slice(1);
    if (/^[0-9a-fA-F]{6}$/.test(hex)) return `#${hex.toLowerCase()}`;
    if (/^[0-9a-fA-F]{3}$/.test(hex)) {
      const r = hex[0];
      const g = hex[1];
      const b = hex[2];
      return `#${(r + r + g + g + b + b).toLowerCase()}`;
    }
    return null;
  }
  const m = s.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!m) return null;
  const r = Math.max(0, Math.min(255, parseInt(m[1], 10)));
  const g = Math.max(0, Math.min(255, parseInt(m[2], 10)));
  const b = Math.max(0, Math.min(255, parseInt(m[3], 10)));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}


function getComputedDefineColor(node) {
  if (!node || typeof window === "undefined" || !window.getComputedStyle) return null;
  try {
    const tag = node.tagName ? node.tagName.toLowerCase() : "";
    const cs = window.getComputedStyle(node);
    const raw =
      tag === "stop"
        ? (cs.getPropertyValue("stop-color") || node.getAttribute("stop-color"))
        : (cs.getPropertyValue("fill") || node.getAttribute("fill"));
    return normalizeCssToHex(raw);
  } catch (e) {
    return null;
  }
}

function extractDefineColorsFromSvg(svg) {
  const out = {};
  if (!svg || typeof DOMParser === "undefined") return out;
  try {
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    if (doc.getElementsByTagName("parsererror")[0]) return out;
    const nodes = Array.from(doc.querySelectorAll("[data-define]"));
    nodes.forEach((n) => {
      const key = n.getAttribute("data-define");
      if (!key || out[key]) return;
      const tag = n.tagName ? n.tagName.toLowerCase() : "";
      const raw = tag === "stop" ? n.getAttribute("stop-color") : n.getAttribute("fill");
      const hex = normalizeCssToHex(raw);
      if (hex) out[key] = hex;
    });
  } catch (e) {
    console.error(e);
  }
  return out;
}

function formatDefineLabel(base) {
  if (!base) return "";
  const lower = base.toLowerCase();
  let suffix = "";
  let suffixLen = 0;
  if (lower.endsWith("acc")) {
    suffix = "Accessory";
    suffixLen = 3;
  } else if (lower.endsWith("lt")) {
    suffix = "Light";
    suffixLen = 2;
  } else if (lower.endsWith("dk")) {
    suffix = "Dark";
    suffixLen = 2;
  } else if (lower.endsWith("vl")) {
    suffix = "Very Light";
    suffixLen = 2;
  } else if (lower.endsWith("vd")) {
    suffix = "Very Dark";
    suffixLen = 2;
  }
  let root = suffixLen ? base.slice(0, -suffixLen) : base;
  let isRight = false;
  if (root.length > 1 && root[0] === "R" && root[1] === root[1].toUpperCase()) {
    isRight = true;
    root = root.slice(1);
  }
  let human = root.replace(/([A-Z])/g, " $1").trim();
  if (human.endsWith("s")) human = human.slice(0, -1);
  if (!human) human = base;
  if (isRight) human = `Right ${human}`;
  return suffix ? `${human} (${suffix})` : human;
}

function groupKeyFromBase(base) {
  if (!base) return "Other";
  const lower = base.toLowerCase();
  let suffixLen = 0;
  if (lower.endsWith("acc")) suffixLen = 3;
  else if (lower.endsWith("lt")) suffixLen = 2;
  else if (lower.endsWith("dk")) suffixLen = 2;
  else if (lower.endsWith("vl")) suffixLen = 2;
  else if (lower.endsWith("vd")) suffixLen = 2;

  let root = suffixLen ? base.slice(0, -suffixLen) : base;
  if (root.length > 1 && root[0] === "R" && root[1] === root[1].toUpperCase()) root = root.slice(1);
  const human = root.replace(/([A-Z])/g, " $1").trim();
  return human || base;
}

function isCrossoverSkin(skin) {
  if (!skin) return false;
  const flag = skin.costumeData.IsCrossover;
  if (flag === true) return true;
  if (typeof flag === "string") return flag.toLowerCase() === "true";
  if (typeof flag === "number") return flag === 1;
  return false;
}

function ColorPicker({ value, onChange }) {
  const rafRef = useRef(null);
  const pendingRef = useRef(null);

  const normalizeHexInput = useCallback((v) => {
    if (v == null) return null;
    let s = v.toString().trim();
    if (!s) return null;

    if (s.startsWith("0x") || s.startsWith("0X")) s = s.slice(2);
    if (s.startsWith("#")) s = s.slice(1);

    if (/^[0-9a-fA-F]{8}$/.test(s)) s = s.slice(2);
    if (!/^[0-9a-fA-F]{6}$/.test(s)) return null;

    return `#${s.toLowerCase()}`;
  }, []);

  const normalized = useMemo(() => normalizeHexInput(value) || "#ffffff", [value, normalizeHexInput]);

  const [text, setText] = useState(normalized);

  useEffect(() => {
    setText(normalized);
  }, [normalized]);

  const emit = useCallback(() => {
    rafRef.current = null;
    const v = pendingRef.current;
    pendingRef.current = null;
    if (v && onChange) onChange(v);
  }, [onChange]);

  const onColorInput = useCallback(
    (e) => {
      const v = normalizeHexInput(e.target.value);
      if (!v) return;
      setText(v);
      pendingRef.current = v;
      if (!rafRef.current) rafRef.current = requestAnimationFrame(emit);
    },
    [emit, normalizeHexInput]
  );

  const commitText = useCallback(
    (raw) => {
      const v = normalizeHexInput(raw);
      if (!v) return;
      setText(v);
      pendingRef.current = v;
      if (!rafRef.current) rafRef.current = requestAnimationFrame(emit);
    },
    [emit, normalizeHexInput]
  );

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, []);

  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={normalized}
        onInput={onColorInput}
        className="h-6 w-10 cursor-pointer rounded border border-slate-600 bg-transparent p-0"
      />
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commitText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commitText(e.currentTarget.value);
        }}
        className="h-6 w-24 rounded border border-slate-700 bg-slate-950 px-2 text-[11px] text-slate-200 outline-none focus:border-sky-500"
        spellCheck={false}
        inputMode="text"
        autoComplete="off"
      />
    </div>
  );
}


function parseCssColorToRgb(color) {
  if (!color) return null;
  const c = color.trim();
  if (c[0] === "#") {
    const hex = c.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return [r, g, b];
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return [r, g, b];
    }
    if (hex.length === 8) {
      const r = parseInt(hex.slice(2, 4), 16);
      const g = parseInt(hex.slice(4, 6), 16);
      const b = parseInt(hex.slice(6, 8), 16);
      return [r, g, b];
    }
  }
  const m = c.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (m) return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
  return null;
}

function getContrastingTextColor(color) {
  const rgb = parseCssColorToRgb(color);
  if (!rgb) return "#000000";
  const [r8, g8, b8] = rgb;

  const toLinear = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };

  const r = toLinear(r8);
  const g = toLinear(g8);
  const b = toLinear(b8);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.5 ? "#000000" : "#FFFFFF";
}

function LegendsGrid({
  legends,
  langs,
  browsingLegendIndex,
  activeLegendIndex,
  activeSkinIndex,
  onSelectLegend,
  searchQuery,
}) {
  if (!legends || !langs) {
    return <div className="px-3 py-2 text-xs text-slate-500">Loading legends…</div>;
  }
  if (!legends.length) {
    return <div className="px-3 py-2 text-xs text-slate-500">No legends available</div>;
  }

  const normalizedQuery = normalizeText(searchQuery);
  const filtered = legends
    .map((legend, index) => {
      const displayNameKey = legend?.DisplayNameKey;
      const legendName =
        (displayNameKey && langs && langs[displayNameKey]) || `Legend ${index + 1}`;
      return { legend, index, legendName };
    })
    .filter((x) => {
      if (!normalizedQuery) return true;
      return normalizeText(x.legendName).includes(normalizedQuery);
    });

  if (!filtered.length) {
    return <div className="px-3 py-2 text-xs text-slate-500">No legends match this search</div>;
  }

  return (
    <div className="grid grid-cols-3 gap-2 p-2 max-h-96 overflow-y-auto border-b border-slate-800 bg-slate-950/80">
      {filtered.map(({ legend, index, legendName }) => {
        const portraitFileName = legend?.heroData?.PortraitFileName;
        const portrait = legend?.heroData?.Portrait;
        const portraitUrl =
          portraitFileName && portrait
            ? `${host}/game/getGfx/${portraitFileName}/${portrait}M`
            : null;

        const isBrowsing = browsingLegendIndex === index;
        const isActive = activeLegendIndex === index && activeSkinIndex != null;

        return (<button
          key={legend?.heroData?.LegendID ?? index}
          type="button"
          onClick={() => onSelectLegend(index)}
          className={([
            "group flex flex-col items-center gap-1 rounded-md border border-slate-700 bg-slate-900/80 p-2 text-[10px]",
            "hover:border-sky-500 hover:bg-slate-900",
            isBrowsing && "border-sky-400",
            isActive && "border-emerald-400"
          ].filter(Boolean).join(" "))}
        >
          <div className="relative w-full overflow-hidden rounded-md bg-slate-950 aspect-square flex items-center justify-center">
            {portraitUrl && (
              <img
                src={portraitUrl}
                alt={legendName}
                className="h-20 w-20 object-contain"
              />
            )}
          </div>
          <div className="w-full truncate text-[10px] font-semibold text-slate-200 text-center">
            {legendName}
          </div>
        </button>
        );
      })}
    </div>
  );
}

function SkinsGrid({
  legend,
  legendIndex,
  langs,
  activeLegendIndex,
  activeSkinIndex,
  onSelectSkin,
  searchQuery,
}) {
  if (!legend) return null;

  const skins = Array.isArray(legend?.skins) ? legend.skins : [];
  if (!skins.length) {
    return <div className="px-3 py-2 text-xs text-slate-500">No skins</div>;
  }

  const normalizedQuery = normalizeText(searchQuery);
  const displayNameKey = legend?.DisplayNameKey;
  const legendName =
    (displayNameKey && langs && langs[displayNameKey]) || `Legend ${legendIndex + 1}`;

  const filtered = skins
    .map((skin, skinIndex) => {
      const costumeData = skin?.costumeData || {};
      let displayKey;
      if (skinIndex === 0 && legend.DisplayNameKey) displayKey = legend.DisplayNameKey;
      else displayKey = costumeData.DisplayNameKey || skin.DisplayNameKey;

      const skinName =
        (displayKey && langs && langs[displayKey]) || `Skin ${skinIndex + 1}`;

      const costumeIconFileName = costumeData.CostumeIconFileName;
      const costumeIcon = costumeData.CostumeIcon;
      const replacementPortraitFileName = costumeData.ReplacementPortraitFileName;
      const replacementPortrait = costumeData.ReplacementPortrait;
      const crossover = isCrossoverSkin(skin);

      let skinIconUrl = null;
      if (crossover && replacementPortraitFileName && replacementPortrait) {
        skinIconUrl = `${host}/game/getGfx/${replacementPortraitFileName}/${replacementPortrait}M`;
      } else if (costumeIconFileName && costumeIcon) {
        skinIconUrl = `${host}/game/getGfx/${costumeIconFileName}/${costumeIcon}`;
      }

      return { skinIndex, skinName, skinIconUrl };
    })
    .filter((x) => {
      if (!normalizedQuery) return true;
      return (
        normalizeText(x.skinName).includes(normalizedQuery) ||
        normalizeText(legendName).includes(normalizedQuery)
      );
    });

  if (!filtered.length) {
    return <div className="px-3 py-2 text-xs text-slate-500">No skins match this search</div>;
  }

  return (
    <div className="p-2 border-t border-slate-800 bg-slate-950/80 overflow-y-auto">
      <div className="px-1 pb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        Skins
      </div>
      <div className="grid grid-cols-3 gap-2">
        {filtered.map(({ skinIndex, skinName, skinIconUrl }) => {
          const isSelected = activeLegendIndex === legendIndex && activeSkinIndex === skinIndex;
          return (
            <button
              key={skinIndex}
              type="button"
              onClick={() => onSelectSkin(legendIndex, skinIndex)}
              className={([
                "group flex flex-col items-center gap-1 rounded-md border border-slate-800 bg-slate-900/80 p-2 text-[10px]",
                "hover:border-sky-500 hover:bg-slate-900",
                isSelected && "border-emerald-400 bg-slate-900"
              ].filter(Boolean).join(" "))}
            >
              <div className="relative w-full overflow-hidden rounded-md bg-slate-950 aspect-square flex items-center justify-center">
                {skinIconUrl && (
                  <img src={skinIconUrl} alt={skinName} className="h-20 w-20 object-contain" />
                )}
              </div>
              <div className="w-full truncate text-[10px] font-medium text-slate-200 text-center">
                {skinName}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}


function MobileHorizontalGrid({ items, renderItem, twoRows }) {
  return (
    <div
      className={([
        "grid gap-2 overflow-x-auto pb-2",
        twoRows ? "grid-rows-2 grid-flow-col auto-cols-[5.75rem]" : "grid-rows-1 grid-flow-col auto-cols-[5.75rem]"
      ].filter(Boolean).join(" "))}
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      {items.map(renderItem)}
    </div>
  );
}

function MobileLegendsRow({ legends, langs, browsingLegendIndex, activeLegendIndex, activeSkinIndex, onSelectLegend, searchQuery }) {
  if (!legends || !langs) return null;
  const q = normalizeText(searchQuery);
  const filtered = legends
    .map((legend, index) => {
      const displayNameKey = legend?.DisplayNameKey;
      const legendName = (displayNameKey && langs && langs[displayNameKey]) || `Legend ${index + 1}`;
      return { legend, index, legendName };
    })
    .filter((x) => !q || normalizeText(x.legendName).includes(q));

  const twoRows = !!q;

  return (
    <div className="px-2 pt-2">
      <MobileHorizontalGrid
        items={filtered}
        twoRows={twoRows}
        renderItem={({ legend, index, legendName }) => {
          const portraitFileName = legend?.heroData?.PortraitFileName;
          const portrait = legend?.heroData?.Portrait;
          const portraitUrl = portraitFileName && portrait ? `${host}/game/getGfx/${portraitFileName}/${portrait}M` : null;
          const isBrowsing = browsingLegendIndex === index;
          const isActive = activeLegendIndex === index && activeSkinIndex != null;

          return (
            <button
              key={legend?.heroData?.LegendID ?? index}
              type="button"
              onClick={() => onSelectLegend(index)}
              className={([
                "flex flex-col items-center gap-1 rounded-md border border-slate-700 bg-slate-900/80 p-2 text-[10px]",
                "hover:border-sky-500 hover:bg-slate-900",
                isBrowsing && "border-sky-400",
                isActive && "border-emerald-400"
              ].filter(Boolean).join(" "))}
            >
              <div className="relative w-full overflow-hidden rounded-md bg-slate-950 aspect-square flex items-center justify-center">
                {portraitUrl && <img src={portraitUrl} alt={legendName} className="h-12 w-12 object-contain" />}
              </div>
              <div className="w-full truncate text-[10px] font-semibold text-slate-200 text-center">{legendName}</div>
            </button>
          );
        }}
      />
    </div>
  );
}

function MobileSkinsRow({ legend, legendIndex, langs, activeLegendIndex, activeSkinIndex, onSelectSkin, searchQuery }) {
  if (!legend || !langs) return null;
  const skins = Array.isArray(legend?.skins) ? legend.skins : [];
  if (!skins.length) return null;

  const q = normalizeText(searchQuery);
  const legendName =
    (legend?.DisplayNameKey && langs && langs[legend.DisplayNameKey]) || `Legend ${legendIndex + 1}`;

  const filtered = skins
    .map((skin, skinIndex) => {
      const costumeData = skin?.costumeData || {};
      let displayKey;
      if (skinIndex === 0 && legend.DisplayNameKey) displayKey = legend.DisplayNameKey;
      else displayKey = costumeData.DisplayNameKey || skin.DisplayNameKey;
      const skinName = (displayKey && langs && langs[displayKey]) || `Skin ${skinIndex + 1}`;

      const costumeIconFileName = costumeData.CostumeIconFileName;
      const costumeIcon = costumeData.CostumeIcon;
      const replacementPortraitFileName = costumeData.ReplacementPortraitFileName;
      const replacementPortrait = costumeData.ReplacementPortrait;
      const crossover = isCrossoverSkin(skin);

      let skinIconUrl = null;
      if (crossover && replacementPortraitFileName && replacementPortrait) {
        skinIconUrl = `${host}/game/getGfx/${replacementPortraitFileName}/${replacementPortrait}M`;
      } else if (costumeIconFileName && costumeIcon) {
        skinIconUrl = `${host}/game/getGfx/${costumeIconFileName}/${costumeIcon}`;
      }

      return { skinIndex, skinName, skinIconUrl };
    })
    .filter((x) => !q || normalizeText(x.skinName).includes(q) || normalizeText(legendName).includes(q));

  const twoRows = !!q;

  return (
    <div className="px-2">
      <MobileHorizontalGrid
        items={filtered}
        twoRows={twoRows}
        renderItem={({ skinIndex, skinName, skinIconUrl }) => {
          const isSelected = activeLegendIndex === legendIndex && activeSkinIndex === skinIndex;
          return (
            <button
              key={skinIndex}
              type="button"
              onClick={() => onSelectSkin(legendIndex, skinIndex)}
              className={([
                "flex flex-col items-center gap-1 rounded-md border border-slate-800 bg-slate-900/80 p-2 text-[10px]",
                "hover:border-sky-500 hover:bg-slate-900",
                isSelected && "border-emerald-400 bg-slate-900"
              ].filter(Boolean).join(" "))}
            >
              <div className="relative w-full overflow-hidden rounded-md bg-slate-950 aspect-square flex items-center justify-center">
                {skinIconUrl && <img src={skinIconUrl} alt={skinName} className="h-12 w-12 object-contain" />}
              </div>
              <div className="w-full truncate text-[10px] font-medium text-slate-200 text-center">{skinName}</div>
            </button>
          );
        }}
      />
    </div>
  );
}


const XML_SWAP_ORDER = ["HairLt_Swap", "Hair_Swap", "HairDk_Swap", "Body1VL_Swap", "Body1Lt_Swap", "Body1_Swap", "Body1Dk_Swap", "Body1VD_Swap", "Body1Acc_Swap", "Body2VL_Swap", "Body2Lt_Swap", "Body2_Swap", "Body2Dk_Swap", "Body2VD_Swap", "Body2Acc_Swap", "SpecialVL_Swap", "SpecialLt_Swap", "Special_Swap", "SpecialDk_Swap", "SpecialVD_Swap", "SpecialAcc_Swap", "ClothVL_Swap", "ClothLt_Swap", "Cloth_Swap", "ClothDk_Swap", "WeaponVL_Swap", "WeaponLt_Swap", "Weapon_Swap", "WeaponDk_Swap", "WeaponAcc_Swap", "IndicatorColor"];

function downloadTextFile(filename, text) {
  try {
    const blob = new Blob([text], { type: "application/xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error(e);
  }
}

function downloadBlob(filename, blob) {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error(e);
  }
}

function svgStringToDataUrl(svg) {
  let s = svg;
  if (!/xmlns=/.test(s)) s = s.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s);
}

function getSvgsFromFrames(frames) {
  if (!Array.isArray(frames)) return [];
  return frames.map((f) => (typeof f === "string" ? f : f?.svg)).filter((v) => typeof v === "string" && v.length > 0);
}

function parseSvgNumber(v) {
  const n = Number(String(v).replace(/[a-z%]+$/i, ""));
  return Number.isFinite(n) ? n : null;
}

function extractSvgViewport(svg) {
  const vb = svg.match(/viewBox\s*=\s*"([^"]+)"/i);
  if (vb) {
    const parts = vb[1].trim().split(/[ ,]+/).map((x) => Number(x));
    if (parts.length === 4 && parts.every((x) => Number.isFinite(x))) {
      const [x, y, w, h] = parts;
      if (w > 0 && h > 0) return { x, y, w, h };
    }
  }

  const wMatch = svg.match(/\bwidth\s*=\s*"([^"]+)"/i);
  const hMatch = svg.match(/\bheight\s*=\s*"([^"]+)"/i);
  const w = wMatch ? parseSvgNumber(wMatch[1]) : null;
  const h = hMatch ? parseSvgNumber(hMatch[1]) : null;
  if (w && h && w > 0 && h > 0) return { x: 0, y: 0, w, h };

  return { x: 0, y: 0, w: 256, h: 256 };
}

function unionViewports(viewports) {
  if (!viewports.length) return { x: 0, y: 0, w: 256, h: 256 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const v of viewports) {
    minX = Math.min(minX, v.x);
    minY = Math.min(minY, v.y);
    maxX = Math.max(maxX, v.x + v.w);
    maxY = Math.max(maxY, v.y + v.h);
  }
  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxY - minY);
  return { x: minX, y: minY, w, h };
}

function ensureSvgNamespace(svg) {
  if (/\bxmlns=/.test(svg)) return svg;
  return svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
}

function expandSvgUsesGlobal(svg) {
  if (!svg) return svg;
  try {
    if (typeof DOMParser === "undefined") return svg;
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, "image/svg+xml");
    if (doc.getElementsByTagName("parsererror")[0]) return svg;

    const uses = Array.from(doc.querySelectorAll("use"));
    if (!uses.length) return new XMLSerializer().serializeToString(doc.documentElement);

    const resolveHref = (u) =>
      u.getAttribute("href") ||
      u.getAttribute("xlink:href") ||
      u.getAttributeNS("http://www.w3.org/1999/xlink", "href");

    for (const u of uses) {
      const href = resolveHref(u);
      if (!href || href[0] !== "#") continue;

      const id = href.slice(1);
      const ref = doc.getElementById(id);
      if (!ref) continue;

      const g = doc.createElementNS("http://www.w3.org/2000/svg", "g");

      const attrs = Array.from(u.attributes || []);
      for (const a of attrs) {
        const name = a.name;
        const val = a.value;
        if (name === "href" || name === "xlink:href") continue;
        if (name === "width" || name === "height" || name === "x" || name === "y") continue;
        g.setAttribute(name, val);
      }

      const clone = ref.cloneNode(true);
      clone.removeAttribute("id");
      g.appendChild(clone);

      u.parentNode.replaceChild(g, u);
    }

    return new XMLSerializer().serializeToString(doc.documentElement);
  } catch {
    return svg;
  }
}

function normalizeSvgRootScale(svg) {
  if (!svg) return svg;
  const m = svg.match(/transform="scale\(([^"]+)\)"/i);
  if (!m) return svg;
  const scale = parseFloat(m[1]);
  let s = svg.replace(/transform="scale\([^"]+\)"/i, "");
  if (!Number.isFinite(scale) || scale === 0) return s;

  s = s.replace(/\bwidth\s*=\s*"([^"]+)"/i, (all, w) => {
    const n = parseSvgNumber(w);
    return n != null ? `width="${n * scale}"` : all;
  });

  s = s.replace(/\bheight\s*=\s*"([^"]+)"/i, (all, h) => {
    const n = parseSvgNumber(h);
    return n != null ? `height="${n * scale}"` : all;
  });

  return s;
}

async function measureSvgBBox(svg) {
  const wrapper = document.createElement("div");
  wrapper.style.position = "fixed";
  wrapper.style.left = "-100000px";
  wrapper.style.top = "0";
  wrapper.style.width = "0";
  wrapper.style.height = "0";
  wrapper.style.overflow = "hidden";
  wrapper.style.pointerEvents = "none";
  wrapper.style.opacity = "0";
  wrapper.innerHTML = ensureSvgNamespace(svg);
  const el = wrapper.querySelector("svg");
  if (!el) return null;
  if (!el.getAttribute("xmlns")) el.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  if (!el.getAttribute("width")) el.setAttribute("width", "1");
  if (!el.getAttribute("height")) el.setAttribute("height", "1");
  document.body.appendChild(wrapper);
  try {
    const bb = el.getBBox();
    if (!Number.isFinite(bb.x) || !Number.isFinite(bb.y) || !Number.isFinite(bb.width) || !Number.isFinite(bb.height)) return null;
    if (bb.width <= 0 || bb.height <= 0) return null;
    return { x: bb.x, y: bb.y, w: bb.width, h: bb.height };
  } catch {
    return null;
  } finally {
    wrapper.remove();
  }
}

async function computeUnionViewportFromSvgs(svgs) {
  const boxes = [];
  for (const s of svgs) {
    const bb = await measureSvgBBox(s);
    if (bb) boxes.push(bb);
  }
  if (!boxes.length) {
    const fallback = svgs.map(extractSvgViewport).filter(Boolean);
    if (!fallback.length) return { x: 0, y: 0, w: 1, h: 1 };
    return unionViewports(fallback);
  }
  const minX = Math.min(...boxes.map((b) => b.x));
  const minY = Math.min(...boxes.map((b) => b.y));
  const maxX = Math.max(...boxes.map((b) => b.x + b.w));
  const maxY = Math.max(...boxes.map((b) => b.y + b.h));
  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxY - minY);
  return { x: minX, y: minY, w, h };
}

function applyViewport(svg, viewport) {
  const { x, y, w, h } = viewport;
  const vbStr = `${x} ${y} ${w} ${h}`;
  let s = ensureSvgNamespace(svg);

  s = s.replace(/\bviewBox\s*=\s*"[^"]*"/i, `viewBox="${vbStr}"`);

  const hasViewBox = /\bviewBox\s*=\s*"/i.test(s);
  if (!hasViewBox) {
    s = s.replace(/<svg\b/i, `<svg viewBox="${vbStr}"`);
  }

  const hasWidth = /\bwidth\s*=\s*"/i.test(s);
  const hasHeight = /\bheight\s*=\s*"/i.test(s);

  if (hasWidth) s = s.replace(/\bwidth\s*=\s*"[^"]*"/i, `width="${w}"`);
  if (hasHeight) s = s.replace(/\bheight\s*=\s*"[^"]*"/i, `height="${h}"`);

  if (!hasWidth) s = s.replace(/<svg\b/i, `<svg width="${w}"`);
  if (!hasHeight) s = s.replace(/<svg\b/i, `<svg height="${h}"`);

  return s;
}

async function renderSvgToCanvas(svg, scale = 1) {
  const img = new Image();
  img.decoding = "async";
  const url = svgStringToDataUrl(svg);
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = url;
  });
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return canvas;
}

async function exportCurrentFramePng({ svg, filename, scale = 2 }) {
  try {
    const canvas = await renderSvgToCanvas(svg, scale);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;
    downloadBlob(filename, blob);
  } catch (e) {
    console.error(e);
  }
}

async function exportApng({ frames, filename, fps = 24, scale = 2 }) {
  try {
    const svgs0 = getSvgsFromFrames(frames).map(expandSvgUsesGlobal).map(normalizeSvgRootScale);
    if (!svgs0.length) return;

    const viewport = await computeUnionViewportFromSvgs(svgs0);
    const svgs = svgs0.map((s) => applyViewport(s, viewport));

    const rgbaFrames = [];
    const width = Math.max(1, Math.round(viewport.w * scale));
    const height = Math.max(1, Math.round(viewport.h * scale));

    for (const svg of svgs) {
      const canvas = await renderSvgToCanvas(svg, scale);
      const c2 = document.createElement("canvas");
      c2.width = width;
      c2.height = height;
      const ctx = c2.getContext("2d");
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(canvas, 0, 0, width, height);
      const imgData = ctx.getImageData(0, 0, width, height);
      rgbaFrames.push(imgData.data.buffer);
    }

    const delays = new Array(rgbaFrames.length).fill(Math.round(1000 / fps));
    const apng = UPNG.encode(rgbaFrames, width, height, 0, delays);
    downloadBlob(filename, new Blob([apng], { type: "image/apng" }));
  } catch (e) {
    console.error(e);
  }
}

async function exportGif({ frames, filename, fps = 24, scale = 2 }) {
  try {
    const svgs0 = getSvgsFromFrames(frames).map(expandSvgUsesGlobal).map(normalizeSvgRootScale);
    if (!svgs0.length) return;

    const viewport = await computeUnionViewportFromSvgs(svgs0);
    const svgs = svgs0.map((s) => applyViewport(s, viewport));

    const width = Math.max(1, Math.round(viewport.w * scale));
    const height = Math.max(1, Math.round(viewport.h * scale));
    const delay = Math.max(1, Math.round(1000 / fps));

    const gif = new GIF({
      workers: 2,
      quality: 10,
      workerScript: gifWorkerUrl,
      width,
      height,
    });

    for (const svg of svgs) {
      const canvas = await renderSvgToCanvas(svg, scale);
      const c2 = document.createElement("canvas");
      c2.width = width;
      c2.height = height;
      const ctx = c2.getContext("2d");
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(canvas, 0, 0, width, height);
      gif.addFrame(c2, { delay, copy: true });
    }

    const blob = await new Promise((resolve) => {
      gif.on("finished", resolve);
      gif.render();
    });

    downloadBlob(filename, blob);
  } catch (e) {
    console.error(e);
  }
}

function mostCommonColor(colors) {
  if (!Array.isArray(colors)) return null;

  const counts = new Map();

  for (const c of colors) {
    if (typeof c !== "string") continue;
    const v = c.toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(v)) continue;
    counts.set(v, (counts.get(v) || 0) + 1);
  }

  let best = null;
  let bestCount = 0;

  for (const [k, v] of counts.entries()) {
    if (v > bestCount) {
      best = k;
      bestCount = v;
    }
  }

  return best;
}


export default function AnimDatabase() {
  const [colorData, setColorData] = useState(null);
  const [legendData, setLegendData] = useState(null);
  const [originalLegendData, setOriginalLegendData] = useState(null);
  const [langs, setLangData] = useState(null);

  const [browsingLegendIndex, setBrowsingLegendIndex] = useState(0);
  const [activeLegendIndex, setActiveLegendIndex] = useState(null);
  const [activeSkinIndex, setActiveSkinIndex] = useState(null);

  const [viewMode, setViewMode] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [animType, setAnimType] = useState("selected");
  const [playMode, setPlayMode] = useState("loop");
  const [rawAnimFrames, setRawAnimFrames] = useState(null);
  const [animFrames, setAnimFrames] = useState(null);
  const [animLoading, setAnimLoading] = useState(false);
  const [animError, setAnimError] = useState(null);
  const [selectedFrameIndex, setSelectedFrameIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const [selectedColorKey, setSelectedColorKey] = useState(null);
  const [colorSearchQuery, setColorSearchQuery] = useState("");
  const [skinPresetSearchQuery, setSkinPresetSearchQuery] = useState("");
  const [selectedSkinPresetKey, setSelectedSkinPresetKey] = useState(null);
  const [paletteOverrides, setPaletteOverrides] = useState({});
  const [showAllDefines, setShowAllDefines] = useState(false);

  const [hoveredDefine, setHoveredDefine] = useState(null);
  const [selectedDefineKey, setSelectedDefineKey] = useState(null);

  const svgContainerRef = useRef(null);
  const mainSvgViewportRef = useRef(null);
  const [showPip, setShowPip] = useState(false);
  const pipRef = useRef(null);
  const [pipPos, setPipPos] = useState({ x: null, y: null });
  const [pipDragging, setPipDragging] = useState(false);
  const pipDragRef = useRef({ active: false, pointerId: null, startX: 0, startY: 0, originX: 0, originY: 0 });
  const svgHoverRafRef = useRef(null);
  const svgHoverPendingRef = useRef(null);

  const openGroupsRef = useRef({});
  const [unusedDefinesOpen, setUnusedDefinesOpen] = useState(false);
  const [, forceRerender] = useState(0);

  const legends = useMemo(() => (Array.isArray(legendData) ? legendData : []), [legendData]);
  const normalizedQuery = useMemo(() => normalizeText(searchQuery), [searchQuery]);

  useEffect(() => {
    async function loadAll() {
      try {
        const data = await fetch(`${host}/game/colorSchemeData`).then((res) => res.json());
        const data2 = await fetch(`${host}/game/langs/0`).then((res) => res.json());
        setColorData(data.colors);
        console.log(data.colors)
        setLegendData(data.legends);
        setOriginalLegendData(data.legends);
        setLangData(data2[0].content);

        if (Array.isArray(data.legends) && data.legends.length > 0) {
          setBrowsingLegendIndex(0);
          setActiveLegendIndex(0);
          setActiveSkinIndex(0);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadAll();
  }, []);

  const browsingLegend =
    browsingLegendIndex != null && legends[browsingLegendIndex] ? legends[browsingLegendIndex] : null;

  const activeLegend =
    activeLegendIndex != null && legends[activeLegendIndex] ? legends[activeLegendIndex] : null;

  const activeSkins = activeLegend && Array.isArray(activeLegend.skins) ? activeLegend.skins : null;
  const activeSkin =
    activeSkins && activeSkinIndex != null && activeSkins[activeSkinIndex] ? activeSkins[activeSkinIndex] : null;

  const activeLegendName = activeLegend
    ? (activeLegend.DisplayNameKey && langs && langs[activeLegend.DisplayNameKey])
    : null;

  const activeSkinName = useMemo(() => {
    if (!activeLegend || !activeSkin) return null;
    const skinIndex = activeSkinIndex || 0;
    const costumeData = activeSkin.costumeData || {};
    let displayKey;
    if (skinIndex === 0 && activeLegend.DisplayNameKey) displayKey = activeLegend.DisplayNameKey;
    else displayKey = costumeData.DisplayNameKey || activeSkin.DisplayNameKey;
    return (displayKey && langs && langs[displayKey]) || null;
  }, [activeLegend, activeSkinIndex, activeSkin?.DisplayNameKey, activeSkin?.costumeData?.DisplayNameKey, langs]);

  const crossoverSkins = useMemo(() => {
    const result = [];
    legends.forEach((legend, legendIndex) => {
      const displayNameKey = legend?.DisplayNameKey;
      const legendName =
        (displayNameKey && langs && langs[displayNameKey]) || `Legend ${legendIndex + 1}`;
      const legendNameNorm = normalizeText(legendName);
      const skins = legend && Array.isArray(legend.skins) ? legend.skins : [];
      skins.forEach((skin, skinIndex) => {
        if (!isCrossoverSkin(skin)) return;
        const costumeData = skin?.costumeData || {};
        let displayKey;
        if (skinIndex === 0 && legend.DisplayNameKey) displayKey = legend.DisplayNameKey;
        else displayKey = costumeData.DisplayNameKey || skin.DisplayNameKey;
        const skinName = (displayKey && langs && langs[displayKey]) || `Skin ${skinIndex + 1}`;
        const skinNameNorm = normalizeText(skinName);
        if (normalizedQuery) {
          const matches = legendNameNorm.includes(normalizedQuery) || skinNameNorm.includes(normalizedQuery);
          if (!matches) return;
        }
        const costumeIconFileName = costumeData.CostumeIconFileName;
        const costumeIcon = costumeData.CostumeIcon;
        const replacementPortraitFileName = costumeData.ReplacementPortraitFileName;
        const replacementPortrait = costumeData.ReplacementPortrait;
        let skinIconUrl = null;
        if (replacementPortraitFileName && replacementPortrait) {
          skinIconUrl = `${host}/game/getGfx/${replacementPortraitFileName}/${replacementPortrait}M`;
        } else if (costumeIconFileName && costumeIcon) {
          skinIconUrl = `${host}/game/getGfx/${costumeIconFileName}/${costumeIcon}`;
        }
        result.push({ legendIndex, skinIndex, legendName, skinName, skinIconUrl });
      });
    });
    return result;
  }, [legends, langs, normalizedQuery]);

  const allSkinsWithColors = useMemo(() => {
    if (!Array.isArray(legends) || !langs) return [];
    const result = [];
    legends.forEach((legend, legendIndex) => {
      if (!legend || !Array.isArray(legend.skins)) return;
      const displayNameKey = legend.DisplayNameKey;
      const legendName =
        (displayNameKey && langs && langs[displayNameKey]) || `Legend ${legendIndex + 1}`;

      legend.skins.forEach((skin, skinIndex) => {
        const costumeData = skin?.costumeData;
        if (!costumeData) return;
        const hasColorKeys = Object.keys(costumeData).some((k) => k.endsWith("_Define") || k.endsWith("_Swap"));
        if (!hasColorKeys) return;

        let displayKey;
        if (skinIndex === 0 && legend.DisplayNameKey) displayKey = legend.DisplayNameKey;
        else displayKey = costumeData.DisplayNameKey || skin.DisplayNameKey;

        const skinName = (displayKey && langs && langs[displayKey]) || `Skin ${skinIndex + 1}`;

        const costumeIconFileName = costumeData.CostumeIconFileName;
        const costumeIcon = costumeData.CostumeIcon;
        const replacementPortraitFileName = costumeData.ReplacementPortraitFileName;
        const replacementPortrait = costumeData.ReplacementPortrait;

        const crossover = isCrossoverSkin(skin);
        let skinIconUrl = null;
        if (crossover && replacementPortraitFileName && replacementPortrait) {
          skinIconUrl = `${host}/game/getGfx/${replacementPortraitFileName}/${replacementPortrait}M`;
        } else if (costumeIconFileName && costumeIcon) {
          skinIconUrl = `${host}/game/getGfx/${costumeIconFileName}/${costumeIcon}`;
        }

        result.push({
          legendIndex,
          skinIndex,
          legendName,
          skinName,
          skinIconUrl,
          key: `${legendIndex}-${skinIndex}`,
        });
      });
    });
    return result;
  }, [legends, langs]);

  const activeBaseCostumeData = useMemo(() => {
    const data = Array.isArray(originalLegendData) ? originalLegendData : Array.isArray(legendData) ? legendData : null;
    const legend = data && activeLegendIndex != null ? data[activeLegendIndex] : null;
    const skin = legend?.skins?.[activeSkinIndex ?? 0] || null;
    return skin?.costumeData || null;
  }, [originalLegendData, legendData, activeLegendIndex, activeSkinIndex]);

  const activeCostumeData = useMemo(() => {
    const base = activeBaseCostumeData && typeof activeBaseCostumeData === "object" ? activeBaseCostumeData : {};
    const o = paletteOverrides && typeof paletteOverrides === "object" ? paletteOverrides : {};
    return { ...base, ...o };
  }, [activeBaseCostumeData, paletteOverrides]);

  const defineEntries = [];
  const swapEntries = [];
  const defineMap = {};
  const defineByKey = {};

  if (activeCostumeData) {
    Object.entries(activeCostumeData).forEach(([key, value]) => {
      if (!key.endsWith("_Define")) return;
      if (typeof value === "string" && value.trim() === "") return;
      const base = key.slice(0, -"_Define".length);
      const cssColor = defineToCssColor(value);
      const entry = { key, base, cssColor };
      defineEntries.push(entry);
      defineMap[base.toLowerCase()] = entry;
      defineByKey[key] = entry;
    });

    Object.entries(activeCostumeData).forEach(([key, value]) => {
      if (!key.endsWith("_Swap")) return;
      if (typeof value === "string" && value.trim() === "") return;

      const baseFromKey = key.slice(0, -"_Swap".length);
      const rawTarget = value.toString().trim();
      const normalizedTarget = normalizeDefineValue(rawTarget);

      const isHex =
        typeof normalizedTarget === "string" &&
        /^0x[0-9a-f]{6}$/.test(normalizedTarget);

      /^0x[0-9a-fA-F]{6}$/.test(normalizedTarget) ||
        /^0x[0-9a-fA-F]{8}$/.test(normalizedTarget) ||
        /^#[0-9a-fA-F]{6}$/.test(normalizedTarget) ||
        /^#[0-9a-fA-F]{8}$/.test(normalizedTarget) ||
        /^[0-9a-fA-F]{6}$/.test(normalizedTarget) ||
        /^[0-9a-fA-F]{8}$/.test(normalizedTarget);
      if (isHex) {
        const cssColor = defineToCssColor(normalizedTarget);
        const defineKey = `${baseFromKey}_Define`;
        const existing = defineByKey[defineKey];
        if (existing) existing.cssColor = cssColor;
        else {
          const entry = { key: defineKey, base: baseFromKey, cssColor };
          defineEntries.push(entry);
          defineMap[baseFromKey.toLowerCase()] = entry;
          defineByKey[defineKey] = entry;
        }
        return;
      }

      const targetName = rawTarget.endsWith("_Define")
        ? rawTarget.slice(0, -"_Define".length)
        : rawTarget.endsWith("_Swap")
          ? rawTarget.slice(0, -"_Swap".length)
          : rawTarget;

      const linkedDefine = defineMap[targetName.toLowerCase()] || null;
      swapEntries.push({ key, base: baseFromKey, target: rawTarget, linkedDefine });
    });
  }

  if (showAllDefines) {
    const keys = new Set();
    XML_SWAP_ORDER.forEach((tag) => {
      if (tag === "IndicatorColor") return;
      const base = tag.replace(/_Swap$/, "");
      keys.add(`${base}_Define`);
    });
    if (activeBaseCostumeData && typeof activeBaseCostumeData === "object") {
      Object.keys(activeBaseCostumeData).forEach((k) => {
        if (k.endsWith("_Define")) keys.add(k);
      });
    }
    if (paletteOverrides && typeof paletteOverrides === "object") {
      Object.keys(paletteOverrides).forEach((k) => {
        if (k.endsWith("_Define")) keys.add(k);
      });
    }
    Array.from(keys).forEach((k) => {
      if (defineByKey[k]) return;
      const base = k.slice(0, -"_Define".length);
      const cssColor = defineToCssColor(activeCostumeData?.[k]);
      const entry = { key: k, base, cssColor };
      defineEntries.push(entry);
      defineMap[base.toLowerCase()] = entry;
      defineByKey[k] = entry;
    });
  }

  const baseDefineColorMap = useMemo(() => buildDefineColorMap(defineEntries) || {}, [defineEntries]);

  const defineColorMap = useMemo(() => {
    const map = { ...baseDefineColorMap };
    swapEntries.forEach(({ base, linkedDefine }) => {
      if (!linkedDefine || !linkedDefine.cssColor) return;
      map[`${base}_Define`] = linkedDefine.cssColor;
    });
    return map;
  }, [baseDefineColorMap, swapEntries]);

  const effectiveDefineColors = useMemo(() => {
    const map = {};
    defineEntries.forEach(({ key, cssColor }) => {
      if (cssColor) map[key] = cssColor;
    });
    swapEntries.forEach(({ base, linkedDefine }) => {
      if (!linkedDefine || !linkedDefine.cssColor) return;
      map[`${base}_Define`] = linkedDefine.cssColor;
    });
    return map;
  }, [defineEntries, swapEntries]);

  const defineCss = useMemo(() => {
    const entries = Object.entries(defineColorMap || {});
    if (!entries.length) return "";
    return entries
      .filter(([, cssColor]) => !!cssColor)
      .map(
        ([key, cssColor]) =>
          `[data-define="${key}"] { fill: ${cssColor} !important; stop-color: ${cssColor} !important; }`
      )
      .join("\n");
  }, [defineColorMap]);

  const usedDefineKeys = useMemo(() => {
    const set = new Set();
    const svg =
      rawAnimFrames && rawAnimFrames.length
        ? (typeof rawAnimFrames[0] === "string" ? rawAnimFrames[0] : rawAnimFrames[0]?.svg)
        : null;
    if (!svg || typeof DOMParser === "undefined") return set;
    try {
      const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
      if (doc.getElementsByTagName("parsererror")[0]) return set;
      doc.querySelectorAll("[data-define]").forEach((n) => {
        const v = n.getAttribute("data-define");
        if (v) set.add(v);
      });
    } catch (e) {
      console.error(e);
    }
    return set;
  }, [rawAnimFrames]);

  const usedDefineEntries = useMemo(
    () => defineEntries.filter((d) => usedDefineKeys.has(d.key)),
    [defineEntries, usedDefineKeys]
  );
  const unusedDefineEntries = useMemo(
    () => defineEntries.filter((d) => !usedDefineKeys.has(d.key)),
    [defineEntries, usedDefineKeys]
  );

  const grouped = useMemo(() => {
    const map = new Map();
    const add = (group, kind, item) => {
      if (!map.has(group)) map.set(group, { defines: [], swaps: [] });
      map.get(group)[kind].push(item);
    };
    usedDefineEntries.forEach((d) => add(groupKeyFromBase(d.base), "defines", d));
    swapEntries.forEach((s) => add(groupKeyFromBase(s.base), "swaps", s));
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [usedDefineEntries, swapEntries]);

  const pendingDefineUpdatesRef = useRef({});
  const rafIdRef = useRef(null);

  const flushPendingDefineUpdates = useCallback(() => {
    const pending = pendingDefineUpdatesRef.current;
    pendingDefineUpdatesRef.current = {};
    rafIdRef.current = null;

    const updates = Object.entries(pending);
    if (!updates.length) return;

    setPaletteOverrides((prev) => {
      const next = { ...(prev || {}) };
      updates.forEach(([k, v]) => {
        next[k] = v;
      });
      return next;
    });
  }, []);

  const handleDefineColorChange = useCallback(
    (defineKey, cssColor) => {
      const defineValue = cssToDefine(cssColor);
      if (!defineValue) return;
      pendingDefineUpdatesRef.current[defineKey] = defineValue;
      if (!rafIdRef.current) rafIdRef.current = requestAnimationFrame(flushPendingDefineUpdates);
    },
    [flushPendingDefineUpdates]
  );

  function handleSwapTargetChange(swapKey, targetBase) {
    if (!targetBase) return;
    setPaletteOverrides((prev) => ({ ...(prev || {}), [swapKey]: targetBase }));
  }

  function extractActiveColorOverrides(data, legendIndex, skinIndex) {
    const legend = Array.isArray(data) ? data[legendIndex] : null;
    const skin = legend?.skins?.[skinIndex];
    const costumeData = skin?.costumeData || null;
    if (!costumeData) return null;
    const overrides = {};
    Object.entries(costumeData).forEach(([k, v]) => {
      if (k.endsWith("_Define") || k.endsWith("_Swap")) overrides[k] = v;
    });
    return overrides;
  }

  const getBaseCostumeData = useCallback(
    (legendIndex, skinIndex) => {
      const data = Array.isArray(originalLegendData) ? originalLegendData : Array.isArray(legendData) ? legendData : null;
      const legend = data && legendIndex != null ? data[legendIndex] : null;
      const skin = legend?.skins?.[skinIndex ?? 0] || null;
      return (skin && skin.costumeData) ? skin.costumeData : null;
    },
    [originalLegendData, legendData]
  );

  const overridesMatchBase = useCallback((overrides, base) => {
    const o = overrides && typeof overrides === "object" ? overrides : {};
    const keys = Object.keys(o);
    if (!keys.length) return true;
    const b = base && typeof base === "object" ? base : {};
    for (const k of keys) {
      if (o[k] == null) continue;
      if ((b[k] ?? null) !== o[k]) return false;
    }
    return true;
  }, []);

  const normalizeOverridesForTarget = useCallback(
    (overrides, targetBase) => {
      const o = overrides && typeof overrides === "object" ? overrides : {};
      const b = targetBase && typeof targetBase === "object" ? targetBase : {};
      if (showAllDefines) return { ...o };
      const next = {};
      Object.entries(o).forEach(([k, v]) => {
        if (k in b) next[k] = v;
      });
      return next;
    },
    [showAllDefines]
  );

  function selectLegendDefaultSkin(nextLegendIndex) {
    const nextSkinIndex = 0;
    const oldBase =
      activeLegendIndex != null && activeSkinIndex != null ? getBaseCostumeData(activeLegendIndex, activeSkinIndex) : null;
    const shouldReset = overridesMatchBase(paletteOverrides, oldBase);
    const nextBase = getBaseCostumeData(nextLegendIndex, nextSkinIndex);
    const nextOverrides = shouldReset ? {} : normalizeOverridesForTarget(paletteOverrides, nextBase);

    setBrowsingLegendIndex(nextLegendIndex);
    setActiveLegendIndex(nextLegendIndex);
    setActiveSkinIndex(nextSkinIndex);
    setSelectedFrameIndex(0);
    setIsAnimating(false);
    setSelectedColorKey(null);
    setSelectedSkinPresetKey(null);
    setPaletteOverrides(nextOverrides);
  }

  function selectActiveSkin(nextLegendIndex, nextSkinIndex) {
    const oldBase =
      activeLegendIndex != null && activeSkinIndex != null ? getBaseCostumeData(activeLegendIndex, activeSkinIndex) : null;
    const shouldReset = overridesMatchBase(paletteOverrides, oldBase);
    const nextBase = getBaseCostumeData(nextLegendIndex, nextSkinIndex);
    const nextOverrides = shouldReset ? {} : normalizeOverridesForTarget(paletteOverrides, nextBase);

    setActiveLegendIndex(nextLegendIndex);
    setActiveSkinIndex(nextSkinIndex);
    setSelectedFrameIndex(0);
    setIsAnimating(false);
    setSelectedColorKey(null);
    setSelectedSkinPresetKey(null);
    setPaletteOverrides(nextOverrides);
  }

  function resetDefineToDefault(defineKey) {
    const base = activeLegendIndex != null && activeSkinIndex != null ? getBaseCostumeData(activeLegendIndex, activeSkinIndex) : null;
    const baseVal = base && defineKey in base ? base[defineKey] : null;
    setPaletteOverrides((prev) => {
      const next = { ...(prev || {}) };
      if (baseVal == null) delete next[defineKey];
      else next[defineKey] = baseVal;
      return next;
    });
  }

  function resetSwapToDefault(swapKey) {
    const base = activeLegendIndex != null && activeSkinIndex != null ? getBaseCostumeData(activeLegendIndex, activeSkinIndex) : null;
    const baseVal = base && swapKey in base ? base[swapKey] : null;
    setPaletteOverrides((prev) => {
      const next = { ...(prev || {}) };
      if (baseVal == null) delete next[swapKey];
      else next[swapKey] = baseVal;
      return next;
    });
  }

  function resetAllColorsToDefault() {
    setPaletteOverrides({});
  }

  function applyColorSchemeFromColorData(colorEntry, selectionKey) {
    if (!colorEntry || !colorEntry.colorData) return;
    const palette = colorEntry.colorData;
    setSelectedColorKey(selectionKey || null);
    setSelectedSkinPresetKey(null);

    const base = activeLegendIndex != null && activeSkinIndex != null ? getBaseCostumeData(activeLegendIndex, activeSkinIndex) : null;
    const baseObj = base && typeof base === "object" ? base : {};

    setPaletteOverrides((prev) => {
      const next = { ...(prev || {}) };
      Object.entries(palette).forEach(([key, value]) => {
        if (!key.endsWith("_Swap")) return;
        const baseName = key.slice(0, -"_Swap".length);
        const defineKey = `${baseName}_Define`;
        if (showAllDefines || defineKey in baseObj) next[defineKey] = normalizeDefineValue(value);

      });
      return showAllDefines ? next : normalizeOverridesForTarget(next, baseObj);
    });
  }

  function applyColorSchemeFromSkin(sourceLegendIndex, sourceSkinIndex, presetKey) {
    if (activeLegendIndex == null || activeSkinIndex == null) return;
    setSelectedSkinPresetKey(presetKey || `${sourceLegendIndex}-${sourceSkinIndex}`);
    setSelectedColorKey(null);

    const sourceLegend = legends?.[sourceLegendIndex];
    const sourceSkin = sourceLegend?.skins?.[sourceSkinIndex];
    const srcCostume = sourceSkin?.costumeData || null;
    if (!srcCostume) return;

    const base = getBaseCostumeData(activeLegendIndex, activeSkinIndex);
    const baseObj = base && typeof base === "object" ? base : {};

    setPaletteOverrides((prev) => {
      const next = { ...(prev || {}) };
      Object.entries(srcCostume).forEach(([k, v]) => {
        if (!(k.endsWith("_Define") || k.endsWith("_Swap"))) return;
        if (showAllDefines || k in baseObj) next[k] = normalizeDefineValue(v);

      });
      return showAllDefines ? next : normalizeOverridesForTarget(next, baseObj);
    });
  }

  const animTypesKey = useMemo(() => {
    const t = activeSkin?.animTypes;
    if (!t) return "";
    return ["idle", "idleOther", "selected", "selectedOther"].map((k) => `${k}:${t[k] || ""}`).join("|");
  }, [activeSkin?.animTypes]);

  const animTypeOptions = useMemo(() => {
    const t = activeSkin?.animTypes;
    if (!t) return [];
    const options = [];
    if (t.idle) options.push({ key: "idle", label: "Idle" });
    if (t.idleOther && t.idleOther !== t.idle) options.push({ key: "idleOther", label: "Idle (Other)" });
    if (t.selected) options.push({ key: "selected", label: "Selected" });
    if (t.selectedOther && t.selectedOther !== t.selected) options.push({ key: "selectedOther", label: "Selected (Other)" });
    return options;
  }, [animTypesKey]);

  useEffect(() => {
    if (!activeSkin || !animTypeOptions.length) return;
    if (animTypeOptions.some((o) => o.key === animType)) return;

    const crossover = isCrossoverSkin(activeSkin);
    let preferred = null;
    if (crossover) {
      preferred =
        animTypeOptions.find((opt) => opt.key === "selectedOther")?.key ||
        animTypeOptions.find((opt) => opt.key === "idleOther")?.key ||
        null;
    }
    if (!preferred) {
      preferred =
        animTypeOptions.find((opt) => opt.key === "selected")?.key ||
        animTypeOptions.find((opt) => opt.key === "idle")?.key ||
        animTypeOptions[0].key;
    }
    setAnimType(preferred);
    setSelectedFrameIndex(0);
    setIsAnimating(false);
  }, [activeLegendIndex, activeSkinIndex, animTypesKey, animTypeOptions, animType, activeSkin]);

  const animUrl = useMemo(() => {
    if (!activeLegend || activeSkinIndex == null || !activeSkin) return null;
    if (!activeLegend.heroData?.HeroID) return null;
    if (!activeSkin.animTypes) return null;
    const typeKey = animType || "selected";
    const typePath = activeSkin.animTypes[typeKey];
    if (!typePath) return null;
    const heroId = activeLegend.heroData.HeroID;
    const skinIndex = activeSkinIndex;
    const mode = playMode || "loop";
    return `${host}/game/anim-svg/char/${heroId}-${skinIndex}/Animation_CharacterSelect/a__CharacterSelectAnimation/${typePath}/${mode}`;
  }, [activeLegend, activeSkin, activeSkinIndex, animType, playMode]);

  useEffect(() => {
    if (!animUrl) {
      setRawAnimFrames(null);
      setAnimFrames(null);
      setAnimLoading(false);
      setAnimError(null);
      setSelectedFrameIndex(0);
      setIsAnimating(false);
      return;
    }
    let cancelled = false;
    setAnimLoading(true);
    setAnimError(null);
    setSelectedFrameIndex(0);
    setIsAnimating(false);

    async function loadAnim() {
      try {
        const res = await fetch(animUrl);
        let json;
        try {
          json = await res.json();
        } catch {
          json = null;
        }
        if (cancelled) return;
        const frames = Array.isArray(json) ? json : (json && Array.isArray(json.frames) ? json.frames : []);
        setRawAnimFrames(frames);
        setAnimFrames(frames);
        setAnimLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setRawAnimFrames(null);
        setAnimFrames(null);
        setAnimLoading(false);
        setAnimError("Failed to load animation");
      }
    }
    loadAnim();
    return () => {
      cancelled = true;
    };
  }, [animUrl]);

  const totalFrames = Array.isArray(animFrames) ? animFrames.length : 0;
  const clampedFrameIndex = totalFrames > 0 ? Math.min(Math.max(selectedFrameIndex, 0), totalFrames - 1) : 0;
  const currentFrame = totalFrames > 0 ? animFrames?.[clampedFrameIndex] : null;

  const baseCurrentFrameSvg =
    typeof currentFrame === "string"
      ? currentFrame
      : currentFrame && typeof currentFrame.svg === "string"
        ? currentFrame.svg
        : null;

  let displayFrameSvg = baseCurrentFrameSvg;
  if (
    clampedFrameIndex === 0 &&
    rawAnimFrames &&
    Array.isArray(rawAnimFrames) &&
    rawAnimFrames.length > 0 &&
    defineColorMap &&
    Object.keys(defineColorMap).length > 0
  ) {
    const frame0 = rawAnimFrames[0];
    const baseSvg0 = typeof frame0 === "string" ? frame0 : frame0?.svg;
    if (baseSvg0) displayFrameSvg = applyDefinesToSvg(baseSvg0, defineColorMap);
  }

  const svgDefineFallback = useMemo(() => extractDefineColorsFromSvg(displayFrameSvg || baseCurrentFrameSvg), [displayFrameSvg, baseCurrentFrameSvg]);
  function expandSvgUses(svg) {
    if (!svg) return svg;
    try {
      if (typeof DOMParser === "undefined") return svg;
      const parser = new DOMParser();
      const doc = parser.parseFromString(svg, "image/svg+xml");
      if (doc.getElementsByTagName("parsererror")[0]) return svg;

      const uses = Array.from(doc.querySelectorAll("use"));
      if (!uses.length) return new XMLSerializer().serializeToString(doc.documentElement);

      const resolveHref = (u) =>
        u.getAttribute("href") ||
        u.getAttribute("xlink:href") ||
        u.getAttributeNS("http://www.w3.org/1999/xlink", "href");

      for (const u of uses) {
        const href = resolveHref(u);
        if (!href || href[0] !== "#") continue;

        const id = href.slice(1);
        const ref = doc.getElementById(id);
        if (!ref) continue;

        const g = doc.createElementNS("http://www.w3.org/2000/svg", "g");

        const attrs = Array.from(u.attributes || []);
        for (const a of attrs) {
          const name = a.name;
          const val = a.value;
          if (name === "href" || name === "xlink:href") continue;
          if (name === "width" || name === "height" || name === "x" || name === "y") continue;
          g.setAttribute(name, val);
        }

        const clone = ref.cloneNode(true);
        clone.removeAttribute("id");
        g.appendChild(clone);

        u.parentNode.replaceChild(g, u);
      }

      return new XMLSerializer().serializeToString(doc.documentElement);
    } catch (e) {
      console.error("expandSvgUses error", e);
      return svg;
    }
  }

  const scaledSvg = useMemo(() => {
    if (!displayFrameSvg) return null;
    const expanded = expandSvgUses(displayFrameSvg);

    const scaleMatch = expanded.match(/transform="scale\(([^"]+)\)"/);
    if (!scaleMatch) return expanded;

    const scale = parseFloat(scaleMatch[1]);
    return expanded
      .replace(/transform="scale\([^"]+\)"/, "")
      .replace(/width="([^"]+)"/, (_, w) => `width="${parseFloat(w) * scale}"`)
      .replace(/height="([^"]+)"/, (_, h) => `height="${parseFloat(h) * scale}"`);
  }, [displayFrameSvg]);

  useEffect(() => {
    const el = mainSvgViewportRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => {
        const e = entries && entries[0];
        if (!e) return;
        const visible = e.isIntersecting && e.intersectionRatio > 0.2;
        setShowPip(!visible);
      },
      { root: null, threshold: [0, 0.2, 0.6, 1] }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [scaledSvg]);


  const clampPipPos = useCallback((pos) => {
    if (typeof window === "undefined") return pos;
    const pad = 8;
    const rect = pipRef.current ? pipRef.current.getBoundingClientRect() : { width: 160, height: 120 };
    const maxX = Math.max(pad, window.innerWidth - rect.width - pad);
    const maxY = Math.max(pad, window.innerHeight - rect.height - pad);
    return {
      x: Math.max(pad, Math.min(pos.x, maxX)),
      y: Math.max(pad, Math.min(pos.y, maxY)),
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPipPos((p) => {
      if (p && p.x != null && p.y != null) return clampPipPos(p);
      const x = Math.max(8, window.innerWidth - 160 - 16);
      const y = 64;
      return clampPipPos({ x, y });
    });
    const onResize = () => setPipPos((p) => (p && p.x != null && p.y != null ? clampPipPos(p) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clampPipPos]);

  const startPipDrag = useCallback(
    (e) => {
      if (!e) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const current = pipPos && pipPos.x != null && pipPos.y != null ? pipPos : { x: 8, y: 64 };
      pipDragRef.current = {
        active: true,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        originX: current.x,
        originY: current.y,
      };
      setPipDragging(true);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch { }
    },
    [pipPos]
  );

  useEffect(() => {
    if (!pipDragging) return;
    const onMove = (e) => {
      const st = pipDragRef.current;
      if (!st.active) return;
      if (st.pointerId != null && e.pointerId !== st.pointerId) return;
      const next = { x: st.originX + (e.clientX - st.startX), y: st.originY + (e.clientY - st.startY) };
      setPipPos(clampPipPos(next));
    };
    const end = (e) => {
      const st = pipDragRef.current;
      if (!st.active) return;
      if (st.pointerId != null && e.pointerId !== st.pointerId) return;
      pipDragRef.current = { active: false, pointerId: null, startX: 0, startY: 0, originX: 0, originY: 0 };
      setPipDragging(false);
    };
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [pipDragging, clampPipPos]);


  useEffect(() => {
    if (!isAnimating) return;
    if (totalFrames <= 1) return;
    const interval = setInterval(() => {
      setSelectedFrameIndex((prev) => (totalFrames <= 0 ? 0 : (prev + 1) % totalFrames));
    }, 33);
    return () => clearInterval(interval);
  }, [isAnimating, totalFrames]);

  const selectedCostumeIconFileName = activeCostumeData?.CostumeIconFileName;
  const selectedCostumeIcon = activeCostumeData?.CostumeIcon;
  const selectedReplacementPortraitFileName = activeCostumeData?.ReplacementPortraitFileName;
  const selectedReplacementPortrait = activeCostumeData?.ReplacementPortrait;
  const activeIsCrossover = isCrossoverSkin(activeSkin);

  let activeSkinIconUrl = null;
  if (activeIsCrossover && selectedReplacementPortraitFileName && selectedReplacementPortrait) {
    activeSkinIconUrl = `${host}/game/getGfx/${selectedReplacementPortraitFileName}/${selectedReplacementPortrait}M`;
  } else if (selectedCostumeIconFileName && selectedCostumeIcon) {
    activeSkinIconUrl = `${host}/game/getGfx/${selectedCostumeIconFileName}/${selectedCostumeIcon}`;
  }

  function makeXml() {
    const swaps = {};
    XML_SWAP_ORDER.forEach((tag) => {
      if (tag === "IndicatorColor") return;
      const base = tag.replace(/_Swap$/, "");
      const defineKey = `${base}_Define`;
      const css = defineColorMap && defineColorMap[defineKey] ? defineColorMap[defineKey] : "#ffffff";
      swaps[tag] = css.toLowerCase();
    });

    const indicator =
      mostCommonColor(Object.values(swaps)) ||
      defineColorMap?.["Body1_Define"] ||
      defineColorMap?.["Body2_Define"] ||
      null;


    const lines = [];
    lines.push("<ColorSchemeTypes>");
    lines.push('<ColorSchemeType ColorSchemeName="SvgTemplate">');
    XML_SWAP_ORDER.forEach((tag) => {
      if (tag === "IndicatorColor") {
        if (indicator) lines.push(`<IndicatorColor>${indicator}</IndicatorColor>`);
        return;
      } else {
        lines.push(`<${tag}>${swaps[tag]}</${tag}>`);
      }
    });
    lines.push("</ColorSchemeType>");
    lines.push("</ColorSchemeTypes>");

    const xml = lines.join("");
    downloadTextFile("SvgTemplate.xml", xml);
  }

  const xmlFileInputRef = useRef(null);

  const importXmlText = useCallback((xmlText) => {
    if (!xmlText || typeof DOMParser === "undefined") return;
    let doc;
    try {
      doc = new DOMParser().parseFromString(xmlText, "application/xml");
    } catch {
      return;
    }
    if (!doc || doc.getElementsByTagName("parsererror")[0]) return;

    const overrides = {};
    XML_SWAP_ORDER.forEach((tag) => {
      if (tag === "IndicatorColor") return;
      const el = doc.getElementsByTagName(tag)[0];
      if (!el) return;
      const v = (el.textContent || "").trim();
      const hex = normalizeCssToHex(v);
      if (!hex) return;
      const base = tag.replace(/_Swap$/, "");
      const defineKey = `${base}_Define`;
      const defineVal = cssToDefine(hex);
      if (!defineVal) return;
      overrides[defineKey] = defineVal;
    });

    if (!Object.keys(overrides).length) return;
    setPaletteOverrides((prev) => ({ ...(prev || {}), ...overrides }));
  }, []);

  const onImportXmlFile = useCallback(
    async (file) => {
      if (!file) return;
      let text = "";
      try {
        text = await file.text();
      } catch {
        return;
      }
      importXmlText(text);
    },
    [importXmlText]
  );

  const getDefineBaseFromKey = useCallback((k) => {
    if (!k) return null;
    return k.endsWith("_Define") ? k.slice(0, -"_Define".length) : k;
  }, []);

  const flushSvgHover = useCallback(() => {
    svgHoverRafRef.current = null;
    const pending = svgHoverPendingRef.current;
    if (!pending) return;
    svgHoverPendingRef.current = null;
    const key = pending.key || null;
    if (!key) {
      setHoveredDefine(null);
      return;
    }
    const base = getDefineBaseFromKey(key);
    const color =
      pending.color ||
      (effectiveDefineColors && effectiveDefineColors[key]) ||
      (defineColorMap && defineColorMap[key]) ||
      "#ffffff";
    setHoveredDefine({ key, base, color, x: pending.x, y: pending.y });
  }, [defineColorMap, effectiveDefineColors, getDefineBaseFromKey]);

  const getDefineElFromPointer = useCallback((clientX, clientY) => {

    const root = svgContainerRef.current;
    if (!root) {
      return null;
    }

    const hit = document.elementFromPoint(clientX, clientY);

    if (!hit || !root.contains(hit)) {
      return null;
    }

    let node = hit;
    while (node && node !== root) {
      if (node.getAttribute && node.getAttribute("data-define")) {
        return node;
      }
      node = node.parentNode;
    }

    return null;
  }, []);

  const getDefineElFromEvent = useCallback((e) => {

    if (e && typeof e.composedPath === "function") {
      const path = e.composedPath();

      for (const node of path) {
        if (node?.getAttribute && node.getAttribute("data-define")) {
          return node;
        }
        if (node?.closest) {
          const c = node.closest("[data-define]");
          if (c) {
            return c;
          }
        }
      }
    }

    const t = e?.target;
    if (t?.closest) {
      const c = t.closest("[data-define]");
      if (c) {
        return c;
      }
    }

    const el = getDefineElFromPointer(e?.clientX ?? 0, e?.clientY ?? 0);
    if (el) return el;
    return null;
  }, [getDefineElFromPointer]);

  const onSvgPointerMove = useCallback(
    (e) => {
      if (!svgContainerRef.current) {
        return;
      }

      const el = getDefineElFromEvent(e);
      const key = el?.getAttribute?.("data-define") || null;

      const rect = svgContainerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left + 12, rect.width - 10));
      const y = Math.max(0, Math.min(e.clientY - rect.top + 12, rect.height - 10));

      const computedColor = el ? getComputedDefineColor(el) : null;

      svgHoverPendingRef.current = { key, x, y, color: computedColor };

      if (!svgHoverRafRef.current) {
        svgHoverRafRef.current = requestAnimationFrame(flushSvgHover);
      }
    },
    [flushSvgHover, getDefineElFromEvent]
  );

  const onSvgPointerLeave = useCallback(() => {
    svgHoverPendingRef.current = null;
    if (svgHoverRafRef.current) cancelAnimationFrame(svgHoverRafRef.current);
    svgHoverRafRef.current = null;
    setHoveredDefine(null);
  }, []);

  const onSvgPointerDown = useCallback(
    (e) => {

      const el = getDefineElFromEvent(e);
      const v = el?.getAttribute?.("data-define") || null;

      if (!v) return;

      setSelectedDefineKey(v);

      const base = getDefineBaseFromKey(v);
      const group = groupKeyFromBase(base);

      openGroupsRef.current[group] = true;
      forceRerender((x) => x + 1);
    },
    [getDefineBaseFromKey, getDefineElFromEvent]
  );

  function toggleGroup(group) {
    openGroupsRef.current[group] = !openGroupsRef.current[group];
    forceRerender((x) => x + 1);
  }

  useEffect(() => {
    if (!grouped.length) return;
    const first = grouped[0][0];
    if (openGroupsRef.current[first] == null) {
      openGroupsRef.current[first] = true;
      forceRerender((x) => x + 1);
    }
  }, [grouped]);

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-100">

      <input
        ref={xmlFileInputRef}
        type="file"
        accept=".xml,application/xml,text/xml"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files && e.target.files[0];
          e.target.value = "";
          if (file) await onImportXmlFile(file);
        }}
      />
      {defineCss && <style dangerouslySetInnerHTML={{ __html: defineCss }} />}

      <aside className="hidden xl:flex w-80 border-r border-slate-800 bg-slate-900/80 flex-col">
        <div className="px-3 py-2 border-b border-slate-800">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Legends</div>
          <div className="mt-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-[11px] outline-none focus:border-sky-500"
              placeholder="Search legends or skins"
            />
          </div>
          <div className="mt-2 flex justify-evenly rounded-md bg-slate-800 p-0.5 text-[10px]">
            <button
              type="button"
              onClick={() => setViewMode("all")}
              className={(["px-2 py-1 rounded-md w-full", viewMode === "all" ? "bg-slate-950 text-sky-300" : "text-slate-300"].filter(Boolean).join(" "))}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setViewMode("crossovers")}
              className={(["px-2 py-1 rounded-md w-full", viewMode === "crossovers" ? "bg-slate-950 text-sky-300" : "text-slate-300"].filter(Boolean).join(" "))}
            >
              Crossovers
            </button>
          </div>
        </div>

        <div className="flex flex-col overflow-y-auto bg-slate-950/80">
          {viewMode === "all" && (
            <>
              <LegendsGrid
                legends={legends}
                langs={langs}
                browsingLegendIndex={browsingLegendIndex}
                activeLegendIndex={activeLegendIndex}
                activeSkinIndex={activeSkinIndex}
                searchQuery={searchQuery}
                onSelectLegend={(index) => selectLegendDefaultSkin(index)}
              />
              <SkinsGrid
                legend={browsingLegend}
                legendIndex={browsingLegendIndex}
                langs={langs}
                activeLegendIndex={activeLegendIndex}
                activeSkinIndex={activeSkinIndex}
                searchQuery={searchQuery}
                onSelectSkin={(legendIndex, skinIndex) => selectActiveSkin(legendIndex, skinIndex)}
              />
            </>
          )}

          {viewMode === "crossovers" && (
            <div className="p-2">
              {crossoverSkins.length === 0 && (
                <div className="px-1 py-2 text-xs text-slate-500">No crossovers match this search</div>
              )}
              {crossoverSkins.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {crossoverSkins.map(({ legendIndex, skinIndex, legendName, skinName, skinIconUrl }, i) => {
                    const isSelected = activeLegendIndex === legendIndex && activeSkinIndex === skinIndex;
                    return (
                      <button
                        key={`${legendIndex}-${skinIndex}-${i}`}
                        type="button"
                        onClick={() => {
                          setBrowsingLegendIndex(legendIndex);
                          selectActiveSkin(legendIndex, skinIndex);
                        }}
                        className={([
                          "group flex flex-col items-center gap-1 rounded-md border border-slate-800 bg-slate-900/80 p-2 text-[10px]",
                          "hover:border-sky-500 hover:bg-slate-900",
                          isSelected && "border-emerald-400 bg-slate-900"
                        ].filter(Boolean).join(" "))}
                      >
                        <div className="relative w-full overflow-hidden rounded-md bg-slate-950 aspect-square flex items-center justify-center">
                          {skinIconUrl && <img src={skinIconUrl} alt={skinName} className="h-20 w-20 object-contain" />}
                        </div>
                        <div className="w-full truncate text-[10px] font-semibold text-slate-200 text-center">{skinName}</div>
                        <div className="w-full truncate text-[9px] text-slate-400 text-center">{legendName}</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </aside>


      <div className="lg:hidden flex flex-col min-w-0">
        <div className="border-b border-slate-800 bg-slate-950/80">
          <div className="px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Browse</div>
            <div className="mt-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-2 text-[12px] outline-none focus:border-sky-500"
                placeholder="Search legends or skins"
              />
            </div>
            <div className="mt-2 flex justify-evenly rounded-md bg-slate-800 p-0.5 text-[10px]">
              <button
                type="button"
                onClick={() => setViewMode("all")}
                className={(["px-3 py-2 rounded-md w-full", viewMode === "all" ? "bg-slate-950 text-sky-300" : "text-slate-300"].filter(Boolean).join(" "))}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setViewMode("crossovers")}
                className={(["px-3 py-2 rounded-md w-full", viewMode === "crossovers" ? "bg-slate-950 text-sky-300" : "text-slate-300"].filter(Boolean).join(" "))}
              >
                Crossovers
              </button>
            </div>
          </div>

          {viewMode === "all" && (
            <>
              <MobileLegendsRow
                legends={legends}
                langs={langs}
                browsingLegendIndex={browsingLegendIndex}
                activeLegendIndex={activeLegendIndex}
                activeSkinIndex={activeSkinIndex}
                searchQuery={searchQuery}
                onSelectLegend={(index) => selectLegendDefaultSkin(index)}
              />
              <MobileSkinsRow
                legend={browsingLegend}
                legendIndex={browsingLegendIndex}
                langs={langs}
                activeLegendIndex={activeLegendIndex}
                activeSkinIndex={activeSkinIndex}
                searchQuery={searchQuery}
                onSelectSkin={(legendIndex, skinIndex) => selectActiveSkin(legendIndex, skinIndex)}
              />
            </>
          )}

          {viewMode === "crossovers" && (
            <div className="px-2 pb-2">
              <MobileHorizontalGrid
                items={crossoverSkins}
                twoRows={!!normalizedQuery}
                renderItem={({ legendIndex, skinIndex, legendName, skinName, skinIconUrl }, i) => {
                  const isSelected = activeLegendIndex === legendIndex && activeSkinIndex === skinIndex;
                  return (
                    <button
                      key={`${legendIndex}-${skinIndex}-${i}`}
                      type="button"
                      onClick={() => {
                        setBrowsingLegendIndex(legendIndex);
                        selectActiveSkin(legendIndex, skinIndex);
                      }}
                      className={([
                        "flex flex-col items-center gap-1 rounded-md border border-slate-800 bg-slate-900/80 p-2 text-[10px]",
                        "hover:border-sky-500 hover:bg-slate-900",
                        isSelected && "border-emerald-400 bg-slate-900"
                      ].filter(Boolean).join(" "))}
                    >
                      <div className="relative w-full overflow-hidden rounded-md bg-slate-950 aspect-square flex items-center justify-center">
                        {skinIconUrl && <img src={skinIconUrl} alt={skinName} className="h-12 w-12 object-contain" />}
                      </div>
                      <div className="w-full truncate text-[10px] font-semibold text-slate-200 text-center">{skinName}</div>
                      <div className="w-full truncate text-[9px] text-slate-400 text-center">{legendName}</div>
                    </button>
                  );
                }}
              />
            </div>
          )}
        </div>

        {!activeLegend || activeSkinIndex == null || !activeSkin ? (
          <div className="flex-1 flex items-center justify-center text-xs text-slate-500 px-3 py-6">Select a skin to view animations.</div>
        ) : (
          <>
            <div className="px-3 py-3 border-b border-slate-800 bg-slate-950/60">
              <div className="flex justify-between gap-3">
                <div className="flex items-center gap-3">
                  {activeSkinIconUrl && (
                    <div className="shrink-0">
                      <img
                        src={activeSkinIconUrl}
                        alt={activeSkinName || "Skin icon"}
                        className="h-16 w-16 rounded-md border border-slate-800 object-contain bg-slate-900"
                      />
                    </div>
                  )}
                  <div className="flex flex-col min-w-0">
                    {activeLegendName && <div className="truncate text-sm font-semibold">{activeLegendName}</div>}
                    {activeSkinName && <div className="truncate text-xs text-slate-400">{activeSkinName}</div>}
                  </div>
                </div>
                <div className="mt-2 flex flex-col gap-2 items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (totalFrames <= 1) {
                          setIsAnimating(false);
                          return;
                        }
                        setIsAnimating((prev) => !prev);
                      }}
                      className={([
                        "min-h-10 px-3 py-2 rounded-md border text-xs",
                        isAnimating
                          ? "border-emerald-500 bg-slate-900 text-emerald-300"
                          : "border-slate-600 text-slate-200 hover:border-emerald-500"
                      ].filter(Boolean).join(" "))}
                    >
                      Animate
                    </button>
                    <div className="text-[11px] text-slate-300">Frame {clampedFrameIndex + 1} / {totalFrames}</div>
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={makeXml}
                        className="px-3 py-2 rounded-md border text-xs border-slate-600 text-slate-200 hover:border-sky-400"
                      >
                        Make XML
                      </button>
                      <button
                        type="button"
                        onClick={() => xmlFileInputRef.current && xmlFileInputRef.current.click()}
                        className="px-3 py-2 rounded-md border text-xs border-slate-600 text-slate-200 hover:border-sky-400"
                      >
                        Import XML
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">

                    <button
                      type="button"
                      onClick={() => {
                        if (!scaledSvg) return;
                        exportCurrentFramePng({
                          svg: scaledSvg,
                          filename: `frame_${clampedFrameIndex + 1}.png`,
                          scale: 4,
                        });
                      }}
                      className="px-3 py-2 rounded-md border text-xs border-slate-600 text-slate-200 hover:border-sky-400"
                    >
                      Save PNG
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        exportApng({
                          frames: processFramesWithDefines(animFrames || [], defineColorMap) || [],
                          filename: `anim_${animType}_${playMode}.apng`,
                          fps: 24,
                          scale: 4,
                        });
                      }}
                      className="px-3 py-2 rounded-md border text-xs border-slate-600 text-slate-200 hover:border-sky-400"
                    >
                      Save APNG
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        exportGif({
                          frames: processFramesWithDefines(animFrames || [], defineColorMap) || [],
                          filename: `anim_${animType}_${playMode}.gif`,
                          fps: 24,
                          scale: 4,
                          workerScript: gifWorkerUrl,
                        });
                      }}
                      className="px-3 py-2 rounded-md border text-xs border-slate-600 text-slate-200 hover:border-sky-400"
                    >
                      Save GIF
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <div className="w-full flex items-center gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAnimating(false);
                      setSelectedFrameIndex((prev) => (prev > 0 ? prev - 1 : prev));
                    }}
                    disabled={totalFrames === 0 || clampedFrameIndex === 0}
                    className={([
                      "min-h-10 px-3 py-2 rounded-md border text-xs",
                      clampedFrameIndex === 0 || totalFrames === 0
                        ? "border-slate-700 text-slate-600 cursor-default"
                        : "border-slate-600 text-slate-200 hover:border-sky-500"
                    ].filter(Boolean).join(" "))}
                  >
                    Prev
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(totalFrames - 1, 0)}
                    value={clampedFrameIndex}
                    onChange={(e) => {
                      setIsAnimating(false);
                      setSelectedFrameIndex(Number(e.target.value));
                    }}
                    className="flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsAnimating(false);
                      setSelectedFrameIndex((prev) => (prev < totalFrames - 1 ? prev + 1 : prev));
                    }}
                    disabled={totalFrames === 0 || clampedFrameIndex === totalFrames - 1}
                    className={([
                      "min-h-10 px-3 py-2 rounded-md border text-xs",
                      clampedFrameIndex === totalFrames - 1 || totalFrames === 0
                        ? "border-slate-700 text-slate-600 cursor-default"
                        : "border-slate-600 text-slate-200 hover:border-sky-500"
                    ].filter(Boolean).join(" "))}
                  >
                    Next
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3">
                  <div className="rounded-md border border-slate-800 bg-slate-900/30 p-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Animation Type</div>
                    <div className="mt-2 flex gap-1">
                      {animTypeOptions.length === 0 && <div className="text-[11px] text-slate-500">No animation types defined for this skin.</div>}
                      {animTypeOptions.length > 0 &&
                        animTypeOptions.map((opt) => (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => {
                              setAnimType(opt.key);
                              setSelectedFrameIndex(0);
                              setIsAnimating(false);
                            }}
                            className={([
                              "px-3 py-2 rounded-md border text-[11px] w-full",
                              animType === opt.key ? "border-sky-500 bg-slate-900 text-sky-300" : "border-slate-700 text-slate-200 hover:border-sky-400"
                            ].filter(Boolean).join(" "))}
                          >
                            {opt.label}
                          </button>
                        ))}
                    </div>
                  </div>

                  <div className="rounded-md border border-slate-800 bg-slate-900/30 p-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Playback</div>
                    <div className="mt-2 flex gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setPlayMode("all");
                          setSelectedFrameIndex(0);
                          setIsAnimating(false);
                        }}
                        className={([
                          "px-3 py-2 rounded-md border text-[11px] w-full",
                          playMode === "all" ? "border-sky-500 bg-slate-900 text-sky-300" : "border-slate-700 text-slate-200 hover:border-sky-400"
                        ].filter(Boolean).join(" "))}
                      >
                        All Frames
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPlayMode("loop");
                          setSelectedFrameIndex(0);
                          setIsAnimating(false);
                        }}
                        className={([
                          "px-3 py-1 rounded-md border text-[11px] w-full",
                          playMode === "loop" ? "border-sky-500 bg-slate-900 text-sky-300" : "border-slate-700 text-slate-200 hover:border-sky-400"
                        ].filter(Boolean).join(" "))}
                      >
                        Loop
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-2 py-2">
              <div ref={mainSvgViewportRef} className="w-full overflow-x-auto rounded-md border border-slate-800 bg-slate-900 p-3">
                {displayFrameSvg ? (
                  <div
                    ref={svgContainerRef}
                    className="relative mx-auto"
                    onPointerMove={onSvgPointerMove}
                    onPointerLeave={onSvgPointerLeave}
                    onPointerDown={onSvgPointerDown}
                  >
                    <div className="[&>svg]:block [&>svg]:max-w-full [&>svg]:h-auto" dangerouslySetInnerHTML={{ __html: scaledSvg }} />
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">No frame SVG</div>
                )}
              </div>
            </div>


            {showPip && scaledSvg && (
              <div
                ref={pipRef}
                onPointerDown={startPipDrag}
                className={([
                  "fixed z-50 w-40 rounded-md border border-slate-800 bg-slate-950/95 shadow-lg overflow-hidden touch-none",
                  pipDragging ? "cursor-grabbing" : "cursor-grab"
                ].filter(Boolean).join(" "))}
                style={{
                  left: pipPos?.x ?? undefined,
                  top: pipPos?.y ?? undefined,
                }}
              >
                <div className="p-1">
                  <div className="[&>svg]:block [&>svg]:w-full [&>svg]:h-auto" dangerouslySetInnerHTML={{ __html: scaledSvg }} />
                </div>
              </div>
            )}

            <div className="px-3 pb-2">
              <div className="rounded-md border border-slate-800 bg-slate-900/40 p-2">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Color Schemes</div>
                <input
                  type="text"
                  value={colorSearchQuery}
                  onChange={(e) => setColorSearchQuery(e.target.value)}
                  className="mt-2 w-full rounded-md bg-slate-950 border border-slate-700 px-2 py-2 text-[12px] outline-none focus:border-sky-500"
                  placeholder="Search palettes"
                />
                {colorData && Array.isArray(colorData) && (
                  <div className="mt-2">
                    {(() => {
                      const allColors = Array.isArray(colorData) ? colorData : [];
                      const normalizedColorQuery = normalizeText(colorSearchQuery);
                      const filteredColors = allColors
                        .map((entry, idx) => {
                          const detail = entry && entry.colorData ? entry.colorData : entry;
                          const nameKey = detail?.DisplayNameKey;
                          const displayName = (nameKey && langs && langs[nameKey]) || nameKey || "Unnamed";
                          if (normalizedColorQuery && !normalizeText(displayName).includes(normalizedColorQuery)) return null;
                          const iconFileName = detail?.IconFileName;
                          const iconName = detail?.IconName;
                          const iconUrl = iconFileName && iconName ? `${host}/game/getGfx/${iconFileName}/${iconName}` : null;
                          const indicatorCss = defineToCssColor(detail?.IndicatorColor) || "#111827";
                          const textColor = getContrastingTextColor(indicatorCss);
                          const selectionKey = nameKey || `${iconFileName || "color"}-${iconName || idx}`;
                          return { entry, displayName, iconUrl, indicatorCss, textColor, selectionKey };
                        })
                        .filter(Boolean);

                      return (
                        <MobileHorizontalGrid
                          items={filteredColors}
                          twoRows={!!colorSearchQuery}
                          renderItem={({ entry, displayName, iconUrl, indicatorCss, textColor, selectionKey }) => {
                            const isSelected = selectedColorKey === selectionKey;
                            return (
                              <button
                                key={selectionKey}
                                type="button"
                                onClick={() => applyColorSchemeFromColorData(entry, selectionKey)}
                                className={([
                                  "rounded-md border p-2 text-left",
                                  isSelected ? "border-emerald-500" : "border-slate-800 hover:border-sky-500"
                                ].filter(Boolean).join(" "))}
                                style={{ backgroundColor: indicatorCss }}
                              >
                                <div className="w-full rounded-md bg-slate-950/70 flex items-center justify-center aspect-square overflow-hidden">
                                  {iconUrl && <img src={iconUrl} alt={displayName} className="h-12 w-12 object-contain" />}
                                </div>
                                <div className="mt-1 w-full truncate text-[10px] font-semibold text-center" style={{ color: textColor }}>
                                  {displayName}
                                </div>
                              </button>
                            );
                          }}
                        />
                      );
                    })()}
                  </div>
                )}
              </div>

              <div className="mt-2 rounded-md border border-slate-800 bg-slate-900/40 p-2">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Skin Color Presets</div>
                <input
                  type="text"
                  value={skinPresetSearchQuery}
                  onChange={(e) => setSkinPresetSearchQuery(e.target.value)}
                  className="mt-2 w-full rounded-md bg-slate-950 border border-slate-700 px-2 py-2 text-[12px] outline-none focus:border-sky-500"
                  placeholder="Search skins"
                />
                <div className="mt-2">
                  <MobileHorizontalGrid
                    items={allSkinsWithColors
                      .map((x) => {
                        const matches = !skinPresetSearchQuery || normalizeText(`${x.legendName} ${x.skinName}`).includes(normalizeText(skinPresetSearchQuery));
                        return matches ? x : null;
                      })
                      .filter(Boolean)}
                    twoRows={!!skinPresetSearchQuery}
                    renderItem={({ legendIndex, skinIndex, legendName, skinName, skinIconUrl, key }) => {
                      const selected = selectedSkinPresetKey === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => applyColorSchemeFromSkin(legendIndex, skinIndex, key)}
                          className={([
                            "rounded-md border bg-slate-950/20 p-2",
                            selected ? "border-emerald-500" : "border-slate-800 hover:border-sky-500"
                          ].filter(Boolean).join(" "))}
                        >
                          <div className="relative w-full overflow-hidden rounded-md bg-slate-950 aspect-square flex items-center justify-center">
                            {skinIconUrl && <img src={skinIconUrl} alt={skinName} className="h-12 w-12 object-contain" />}
                          </div>
                          <div className="mt-1 w-full truncate text-[10px] font-semibold text-center text-slate-100">{skinName}</div>
                          <div className="w-full truncate text-[9px] text-center text-slate-400">{legendName}</div>
                        </button>
                      );
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="px-2 pb-4">
              <div className="rounded-md border border-slate-800 bg-slate-950/40">
                <div className="px-2 py-2 border-b border-slate-800 flex items-center justify-between">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Defines</div>
                  <button type="button" onClick={resetAllColorsToDefault} className="min-h-10 rounded-md border border-slate-700 bg-slate-900/70 px-3 text-xs text-slate-200">
                    Reset
                  </button>
                </div>
                <div className="p-2">
                  <label className="flex items-center gap-2 text-[11px] text-slate-300">
                    <input type="checkbox" checked={showAllDefines} onChange={(e) => setShowAllDefines(e.target.checked)} className="h-4 w-4 rounded border border-slate-700 bg-slate-900" />
                    Show all defines
                  </label>
                </div>
                <div className="p-2 flex flex-col gap-2">
                  {grouped.map(([group, items]) => {
                    const open = !!openGroupsRef.current[group];
                    const count = items.defines.length + items.swaps.length;
                    return (
                      <div key={group} className="rounded-md border border-slate-800 bg-slate-900/40">
                        <button type="button" onClick={() => toggleGroup(group)} className="w-full flex items-center justify-between px-2 py-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {open ? <ChevronDownIcon className="h-4 w-4 text-slate-300 shrink-0" /> : <ChevronRightIcon className="h-4 w-4 text-slate-300 shrink-0" />}
                            <div className="truncate text-[11px] font-semibold text-slate-200">{group}</div>
                          </div>
                          <div className="text-[10px] text-slate-400">{count}</div>
                        </button>
                        {open && (
                          <div className="border-t border-slate-800 px-2 py-2 flex flex-col gap-2">
                            {items.defines.map((d) => {
                              const isSelected = selectedDefineKey === d.key;
                              return (
                                <div key={d.key} className={(["rounded-md border px-2 py-2 flex items-center justify-between gap-2", isSelected ? "border-sky-500 bg-slate-900/80" : "border-slate-800 bg-slate-950/20"].filter(Boolean).join(" "))}>
                                  <div className="min-w-0">
                                    <div className="text-[11px] font-semibold text-slate-200 truncate">{formatDefineLabel(d.base)}</div>
                                    <div className="text-[10px] text-slate-500 truncate">{d.key}</div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <ColorPicker value={d.cssColor} onChange={(cssColor) => handleDefineColorChange(d.key, cssColor)} />
                                    <button type="button" onClick={() => resetDefineToDefault(d.key)} className="min-h-10 rounded-md border border-slate-700 bg-slate-900/70 px-3 text-[10px] text-slate-200 hover:border-sky-400">
                                      Reset
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <main className="hidden lg:flex flex-1">
        <section className="flex-1 border-r border-slate-800 bg-slate-950/80 flex flex-col">
          {!activeLegend || activeSkinIndex == null || !activeSkin ? (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-500">Select a skin to view animations.</div>
          ) : (
            <div className="flex flex-col h-full">
              <div className="border-b border-slate-800 px-4 py-2 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  {activeSkinIconUrl && (
                    <div className="ml-auto">
                      <img
                        src={activeSkinIconUrl}
                        alt={activeSkinName || "Skin icon"}
                        className="h-16 w-16 rounded-md border border-slate-800 object-contain bg-slate-900"
                      />
                    </div>
                  )}
                  <div className="flex flex-col">
                    {activeLegendName && <div className="text-sm font-semibold">{activeLegendName}</div>}
                    {activeSkinName && <div className="text-xs text-slate-400">{activeSkinName}</div>}

                  </div>
                </div>

                <div>
                  <div className="w-full max-w-xl flex items-center gap-3 text-[11px]">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAnimating(false);
                        setSelectedFrameIndex((prev) => (prev > 0 ? prev - 1 : prev));
                      }}
                      disabled={totalFrames === 0 || clampedFrameIndex === 0}
                      className={([
                        "px-2 py-1 rounded-md border text-xs",
                        clampedFrameIndex === 0 || totalFrames === 0
                          ? "border-slate-700 text-slate-600 cursor-default"
                          : "border-slate-600 text-slate-200 hover:border-sky-500"
                      ].filter(Boolean).join(" "))}
                    >
                      Prev
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={Math.max(totalFrames - 1, 0)}
                      value={clampedFrameIndex}
                      onChange={(e) => {
                        setIsAnimating(false);
                        setSelectedFrameIndex(Number(e.target.value));
                      }}
                      className="flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setIsAnimating(false);
                        setSelectedFrameIndex((prev) => (prev < totalFrames - 1 ? prev + 1 : prev));
                      }}
                      disabled={totalFrames === 0 || clampedFrameIndex === totalFrames - 1}
                      className={([
                        "px-2 py-1 rounded-md border text-xs",
                        clampedFrameIndex === totalFrames - 1 || totalFrames === 0
                          ? "border-slate-700 text-slate-600 cursor-default"
                          : "border-slate-600 text-slate-200 hover:border-sky-500"
                      ].filter(Boolean).join(" "))}
                    >
                      Next
                    </button>
                  </div>
                  <div className="mt-2 flex gap-2 justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        if (totalFrames <= 1) {
                          setIsAnimating(false);
                          return;
                        }
                        setIsAnimating((prev) => !prev);
                      }}
                      className={([
                        "px-2 py-1 rounded-md border text-xs",
                        isAnimating
                          ? "border-emerald-500 bg-slate-900 text-emerald-300"
                          : "border-slate-600 text-slate-200 hover:border-emerald-500"
                      ].filter(Boolean).join(" "))}
                    >
                      Animate
                    </button>
                    <div className="flex text-right text-[11px] text-slate-300  items-center">
                      Frame {clampedFrameIndex + 1} / {totalFrames}
                    </div>
                    <button
                      type="button"
                      onClick={() => xmlFileInputRef.current && xmlFileInputRef.current.click()}
                      className="px-2 py-1 rounded-md border text-xs border-slate-600 text-slate-200 hover:border-sky-400"
                    >
                      Import XML
                    </button>

                    <button
                      type="button"
                      onClick={makeXml}
                      className="px-2 py-1 rounded-md border text-xs border-slate-600 text-slate-200 hover:border-sky-400"
                    >
                      Make XML
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!scaledSvg) return;
                        exportCurrentFramePng({
                          svg: scaledSvg,
                          filename: `frame_${clampedFrameIndex + 1}.png`,
                          scale: 4,
                        });
                      }}
                      className="px-2 py-1 rounded-md border text-xs border-slate-600 text-slate-200 hover:border-sky-400"
                    >
                      Save PNG
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        exportApng({
                          frames: processFramesWithDefines(animFrames || [], defineColorMap) || [],
                          filename: `anim_${animType}_${playMode}.apng`,
                          fps: 24,
                          scale: 4,
                        });
                      }}
                      className="px-2 py-1 rounded-md border text-xs border-slate-600 text-slate-200 hover:border-sky-400"
                    >
                      Save APNG
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        exportGif({
                          frames: processFramesWithDefines(animFrames || [], defineColorMap) || [],
                          filename: `anim_${animType}_${playMode}.gif`,
                          fps: 24,
                          scale: 4,
                        });
                      }}
                      className="px-2 py-1 rounded-md border text-xs border-slate-600 text-slate-200 hover:border-sky-400"
                    >
                      Save GIF
                    </button>
                  </div>
                </div>
                <div className="flex text-xs gap-1 text-slate-200">
                  <div className="flex flex-col">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Animation Type</div>
                    <div className="flex flex-col gap-1">
                      {animTypeOptions.length === 0 && (
                        <div className="text-[11px] text-slate-500">No animation types defined for this skin.</div>
                      )}
                      {animTypeOptions.length > 0 && (() => {
                        const idleOpt = animTypeOptions.find((opt) => opt.key === "idle");
                        const idleOtherOpt = animTypeOptions.find((opt) => opt.key === "idleOther");
                        const selectedOpt = animTypeOptions.find((opt) => opt.key === "selected");
                        const selectedOtherOpt = animTypeOptions.find((opt) => opt.key === "selectedOther");

                        const renderButton = (opt) => (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => {
                              setAnimType(opt.key);
                              setSelectedFrameIndex(0);
                              setIsAnimating(false);
                            }}
                            className={([
                              "px-2 py-1 rounded-md border text-[11px] w-full",
                              animType === opt.key
                                ? "border-sky-500 bg-slate-900 text-sky-300"
                                : "border-slate-700 text-slate-200 hover:border-sky-400"
                            ].filter(Boolean).join(" "))}
                          >
                            {opt.label}
                          </button>
                        );

                        return (
                          <>
                            <div className="flex gap-1">
                              {idleOpt && renderButton(idleOpt)}
                              {idleOtherOpt && renderButton(idleOtherOpt)}
                            </div>
                            <div className="flex gap-1">
                              {selectedOpt && renderButton(selectedOpt)}
                              {selectedOtherOpt && renderButton(selectedOtherOpt)}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="flex flex-col">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Playback</div>
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setPlayMode("all");
                          setSelectedFrameIndex(0);
                          setIsAnimating(false);
                        }}
                        className={([
                          "px-2 py-1 rounded-md border text-[11px] w-full",
                          playMode === "all"
                            ? "border-sky-500 bg-slate-900 text-sky-300"
                            : "border-slate-700 text-slate-200 hover:border-sky-400"
                        ].filter(Boolean).join(" "))}
                      >
                        All Frames
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPlayMode("loop");
                          setSelectedFrameIndex(0);
                          setIsAnimating(false);
                        }}
                        className={([
                          "px-2 py-1 rounded-md border text-[11px] w-full",
                          playMode === "loop"
                            ? "border-sky-500 bg-slate-900 text-sky-300"
                            : "border-slate-700 text-slate-200 hover:border-sky-400"
                        ].filter(Boolean).join(" "))}
                      >
                        Loop
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between overflow-y-auto">
                <div className="flex-1 flex flex-col justify-start px-2 py-2">
                  {animLoading && <div className="text-xs text-slate-500">Loading animation…</div>}
                  {!animLoading && animError && <div className="text-xs text-red-400">{animError}</div>}
                  {!animLoading && !animError && totalFrames === 0 && <div className="text-xs text-slate-500">No frames for this animation.</div>}

                  {!animLoading && !animError && totalFrames > 0 && (
                    <div className="w-full flex flex-col gap-4">
                      <div className="w-full flex">
                        <div className="inline-flex rounded-md border border-slate-800 bg-slate-900 px-4 py-4">
                          {displayFrameSvg ? (
                            <div
                              ref={svgContainerRef}
                              className="relative"
                              onPointerMove={onSvgPointerMove}
                              onPointerLeave={onSvgPointerLeave}
                              onPointerDown={onSvgPointerDown}
                            >
                              <div
                                className="[&>svg]:block [&>svg]:max-w-full [&>svg]:h-auto"
                                dangerouslySetInnerHTML={{ __html: scaledSvg }}
                              />
                              {hoveredDefine?.key && (
                                <div
                                  className="pointer-events-none absolute z-50 rounded-md border border-slate-700 bg-slate-950/95 px-2 py-1 text-[11px] shadow-lg"
                                  style={{ left: hoveredDefine.x, top: hoveredDefine.y }}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-slate-200">{hoveredDefine.base}</span>
                                    <span
                                      className="h-3 w-3 rounded border border-slate-600"
                                      style={{ backgroundColor: hoveredDefine.color }}
                                    />
                                    <span className="text-slate-300">{hoveredDefine.color.toUpperCase()}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-xs text-slate-500">Frame has no SVG content.</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="px-2 py-2 w-[520px]">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Color Defines & Swaps</div>

                    <button
                      type="button"
                      onClick={() => setShowAllDefines((v) => !v)}
                      className={([
                        "px-2 py-0.5 rounded-md border text-[10px]",
                        showAllDefines ? "border-emerald-500 bg-slate-900 text-emerald-300" : "border-slate-700 text-slate-200 hover:border-emerald-400"
                      ].filter(Boolean).join(" "))}
                    >
                      Show All Defines
                    </button>
                    <button
                      type="button"
                      onClick={resetAllColorsToDefault}
                      disabled={!originalLegendData}
                      className={([
                        "px-2 py-0.5 rounded-md border text-[10px]",
                        originalLegendData
                          ? "border-slate-700 text-slate-200 hover:border-sky-400"
                          : "border-slate-800 text-slate-600 cursor-default"
                      ].filter(Boolean).join(" "))}
                    >
                      Reset All
                    </button>
                  </div>

                  {defineEntries.length === 0 && swapEntries.length === 0 && (
                    <div className="text-[11px] text-slate-500">No color defines or swaps found on this skin.</div>
                  )}

                  {(defineEntries.length > 0 || swapEntries.length > 0) && (
                    <div className="flex flex-col gap-2">
                      {grouped.map(([group, data]) => {
                        const isOpen = !!openGroupsRef.current[group];
                        return (
                          <div key={group} className="rounded-md border border-slate-800 bg-slate-900/40">
                            <button
                              type="button"
                              onClick={() => toggleGroup(group)}
                              className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-slate-900/60"
                            >
                              <div className="flex items-center gap-2">
                                <span className="h-4 w-4 flex items-center justify-center">
                                  {isOpen ? <ChevronDownIcon className="h-3 w-3" /> : <ChevronRightIcon className="h-3 w-3" />}
                                </span>
                                <span className="text-[11px] font-semibold text-slate-200">{group}</span>
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {data.defines.length} defines · {data.swaps.length} swaps
                              </div>
                            </button>

                            {isOpen && (
                              <div className="p-2 grid grid-cols-3 gap-1">
                                {data.defines.map(({ key, base, cssColor }) => {
                                  const effectiveColor = effectiveDefineColors?.[key] || cssColor || svgDefineFallback?.[key] || "#ffffff";
                                  const isPicked = selectedDefineKey === key;
                                  return (
                                    <div
                                      key={key}
                                      className={([
                                        "flex flex-col rounded-md border bg-slate-900/60 p-2 gap-1",
                                        isPicked ? "border-sky-500" : "border-slate-700"
                                      ].filter(Boolean).join(" "))}
                                    >
                                      <div>
                                        <div className="text-[11px] font-medium">{formatDefineLabel(base)}</div>
                                        <div className="text-[10px] text-slate-400 break-all">{key}</div>
                                      </div>

                                      <div className="mt-1 flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                          <ColorPicker value={effectiveColor} onChange={(newCss) => handleDefineColorChange(key, newCss)} />
                                        </div>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => resetDefineToDefault(key)}
                                        className="rounded-md border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-200 hover:border-sky-400"
                                      >
                                        Reset
                                      </button>
                                    </div>
                                  );
                                })}

                                {data.swaps.map(({ key, base, target, linkedDefine }) => (
                                  <div key={key} className="flex flex-col rounded-md border border-slate-700 bg-slate-900/60 p-2 gap-1">
                                    <div className="text-[11px] font-medium">{formatDefineLabel(base)}</div>
                                    <div className="text-[10px] text-slate-400 break-all">{key}</div>
                                    <div className="mt-1 flex flex-col gap-1">
                                      <div className="flex items-center gap-2">
                                        <div
                                          className="h-4 w-4 rounded border border-slate-600"
                                          style={{ backgroundColor: linkedDefine?.cssColor || "#000000" }}
                                        />
                                        <span className="text-[10px] text-slate-300">
                                          {linkedDefine ? `Linked to ${formatDefineLabel(linkedDefine.base)}` : `Linked to ${target}_Define (missing)`}
                                        </span>
                                      </div>
                                      {defineEntries.length > 0 && (
                                        <select
                                          value={target}
                                          onChange={(e) => handleSwapTargetChange(key, e.target.value)}
                                          className="mt-1 w-full rounded bg-slate-900 border border-slate-700 px-1 py-0.5 text-[10px] outline-none"
                                        >
                                          {defineEntries.map((def) => (
                                            <option key={def.key} value={def.base}>
                                              {formatDefineLabel(def.base)}
                                            </option>
                                          ))}
                                        </select>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => resetSwapToDefault(key)}
                                        className="rounded-md border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-200 hover:border-sky-400"
                                      >
                                        Reset
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {unusedDefineEntries.length > 0 && (
                        <div className="rounded-md border border-slate-800 bg-slate-900/20">
                          <button
                            type="button"
                            onClick={() => setUnusedDefinesOpen((v) => !v)}
                            className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-slate-900/30"
                          >
                            <div className="flex items-center gap-2">
                              <span className="h-4 w-4 flex items-center justify-center">
                                {unusedDefinesOpen ? <ChevronDownIcon className="h-3 w-3" /> : <ChevronRightIcon className="h-3 w-3" />}
                              </span>
                              <span className="text-[11px] font-semibold text-slate-400">Unused Defines (not referenced in selected skin)</span>
                            </div>
                            <div className="text-[10px] text-slate-500">{unusedDefineEntries.length} defines</div>
                          </button>

                          {unusedDefinesOpen && (
                            <div className="p-2 grid grid-cols-3 gap-1">
                              {unusedDefineEntries.map(({ key, base, cssColor }) => {
                                const effectiveColor = effectiveDefineColors?.[key] || cssColor || svgDefineFallback?.[key] || "#ffffff";
                                const isPicked = selectedDefineKey === key;
                                return (
                                  <div
                                    key={key}
                                    className={([
                                      "flex flex-col rounded-md border bg-slate-900/40 p-2 gap-1",
                                      isPicked ? "border-sky-500" : "border-slate-800"
                                    ].filter(Boolean).join(" "))}
                                  >
                                    <div>
                                      <div className="text-[11px] font-medium">{formatDefineLabel(base)}</div>
                                      <div className="text-[10px] text-slate-500 break-all">{key}</div>
                                    </div>
                                    <div className="mt-1 flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-2">
                                        <ColorPicker value={effectiveColor} onChange={(newCss) => handleDefineColorChange(key, newCss)} />
                                        <span className="text-[10px] text-slate-400 text-right">{effectiveColor.toUpperCase()}</span>
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => resetDefineToDefault(key)}
                                      className="rounded-md border border-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300 hover:border-sky-400"
                                    >
                                      Reset
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="w-80 bg-slate-950/80">
          <div className="h-full border-l border-slate-800 px-4 py-3 text-xs text-slate-200 flex flex-col gap-4">
            {!activeLegend || activeSkinIndex == null || !activeSkin ? (
              <div className="text-slate-500">Select a skin to edit colors.</div>
            ) : (
              <>
                {Array.isArray(colorData) && colorData.length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold uppercase tracking-wide text-slate-400">Color Palettes</div>
                      <input
                        type="text"
                        value={colorSearchQuery}
                        onChange={(e) => setColorSearchQuery(e.target.value)}
                        className="ml-2 flex-1 rounded-md bg-slate-950 border border-slate-700 px-2 py-0.5 outline-none"
                        placeholder="Search colors"
                      />
                    </div>

                    {(() => {
                      const allColors = Array.isArray(colorData) ? colorData : [];
                      if (!allColors.length) return <div className="text-[11px] text-slate-500">No colors available.</div>;

                      const normalizedColorQuery = normalizeText(colorSearchQuery);
                      const filteredColors = allColors.filter((entry) => {
                        const detail = entry && entry.colorData ? entry.colorData : entry;
                        const nameKey = detail?.DisplayNameKey;
                        const name = (nameKey && langs && langs[nameKey]) || nameKey || "";
                        if (!normalizedColorQuery) return true;
                        return normalizeText(name).includes(normalizedColorQuery);
                      });

                      if (!filteredColors.length) return <div className="text-[11px] text-slate-500">No colors match this search.</div>;

                      return (
                        <div className="grid grid-cols-3 gap-2 max-h-96 overflow-y-auto pr-1">
                          {filteredColors.map((entry, idx) => {
                            const detail = entry && entry.colorData ? entry.colorData : entry;
                            const nameKey = detail?.DisplayNameKey;
                            const displayName = (nameKey && langs && langs[nameKey]) || nameKey || "Unnamed";
                            const iconFileName = detail?.IconFileName;
                            const iconName = detail?.IconName;
                            const iconUrl = iconFileName && iconName ? `${host}/game/getGfx/${iconFileName}/${iconName}` : null;

                            const indicatorCss = defineToCssColor(detail?.IndicatorColor);
                            const textColor = getContrastingTextColor(indicatorCss);

                            const selectionKey = nameKey || `${iconFileName || "color"}-${iconName || idx}`;
                            const isSelected = selectedColorKey && selectedColorKey === selectionKey;

                            return (
                              <button
                                key={selectionKey}
                                type="button"
                                onClick={() => applyColorSchemeFromColorData(entry, selectionKey)}
                                className={([
                                  "group flex flex-col items-center gap-1 rounded-md border bg-slate-900/80 p-2",
                                  "hover:border-sky-500 hover:bg-slate-900",
                                  isSelected && "border-sky-400 bg-slate-900"
                                ].filter(Boolean).join(" "))}
                                style={{ backgroundColor: indicatorCss }}
                              >
                                <div className="w-full rounded-md bg-slate-950/70 flex items-center justify-center aspect-square overflow-hidden">
                                  {iconUrl && <img src={iconUrl} alt={displayName} className="h-16 w-16 object-contain" />}
                                </div>
                                <div className="w-full truncate font-medium text-center" style={{ color: textColor }}>
                                  {displayName}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {Array.isArray(allSkinsWithColors) && allSkinsWithColors.length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold uppercase tracking-wide text-slate-400">Skin Color Presets</div>
                      <input
                        type="text"
                        value={skinPresetSearchQuery}
                        onChange={(e) => setSkinPresetSearchQuery(e.target.value)}
                        className="ml-2 flex-1 rounded-md bg-slate-950 border border-slate-700 px-2 py-0.5 outline-none"
                        placeholder="Search skins"
                      />
                    </div>

                    {(() => {
                      const normalizedPresetQuery = normalizeText(skinPresetSearchQuery);
                      const filtered = allSkinsWithColors.filter((entry) => {
                        if (!normalizedPresetQuery) return true;
                        const legendNameNorm = normalizeText(entry.legendName);
                        const skinNameNorm = normalizeText(entry.skinName);
                        return legendNameNorm.includes(normalizedPresetQuery) || skinNameNorm.includes(normalizedPresetQuery);
                      });

                      if (!filtered.length) return <div className="text-[11px] text-slate-500">No skins match this search.</div>;

                      return (
                        <div className="grid grid-cols-3 gap-2 max-h-96 overflow-y-auto pr-1">
                          {filtered.map((entry) => {
                            const { legendIndex, skinIndex, legendName, skinName, skinIconUrl, key } = entry;
                            const isSelectedPreset = selectedSkinPresetKey && selectedSkinPresetKey === key;

                            return (
                              <button
                                key={key}
                                type="button"
                                onClick={() => applyColorSchemeFromSkin(legendIndex, skinIndex, key)}
                                className={([
                                  "group flex flex-col items-center gap-1 rounded-md border bg-slate-900/80 p-2",
                                  "hover:border-sky-500 hover:bg-slate-900",
                                  isSelectedPreset && "border-emerald-400 bg-slate-900"
                                ].filter(Boolean).join(" "))}
                              >
                                <div className="w-full rounded-md bg-slate-950/70 flex items-center justify-center aspect-square overflow-hidden">
                                  {skinIconUrl && <img src={skinIconUrl} alt={skinName} className="h-16 w-16 object-contain" />}
                                </div>
                                <div className="w-full truncate text-[10px] font-semibold text-center text-slate-100">{skinName}</div>
                                <div className="w-full truncate text-[9px] text-center text-slate-400">{legendName}</div>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}