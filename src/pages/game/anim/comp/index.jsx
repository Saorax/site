import "../../../../styles/global.css";
import { host } from "../../../../stuff";
import { useState, useEffect, useMemo } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/20/solid";
import "../../../../../fonts/style.css";

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function normalizeAnimData(raw) {
  if (!raw) return {};

  const tree = {};

  for (const bucket of raw) {
    if (!bucket || typeof bucket !== "object") continue;

    for (const value of Object.values(bucket)) {
      if (!value) continue;
      const { filename, index: groupKey, animations } = value;
      if (!filename || !groupKey || !animations) continue;

      const filenameKey = filename.replace(/\.swf$/i, "");

      const animList = Array.isArray(animations)
        ? animations
        : Object.values(animations);

      if (!tree[filenameKey]) tree[filenameKey] = {};
      if (!tree[filenameKey][groupKey]) tree[filenameKey][groupKey] = [];

      tree[filenameKey][groupKey].push(...animList);
    }
  }

  return tree;
}

function filterTree(tree, query) {
  if (!query) return tree;
  if (!tree) return {};

  const q = query.toLowerCase();
  const result = {};

  for (const [filename, groups] of Object.entries(tree)) {
    const filenameMatch = filename.toLowerCase().includes(q);
    let filenameAdded = false;

    for (const [groupKey, anims] of Object.entries(groups || {})) {
      let useAnims = [];
      const groupMatch = groupKey.toLowerCase().includes(q);

      if (filenameMatch || groupMatch) {
        useAnims = Array.isArray(anims) ? anims.slice() : [];
      } else {
        useAnims = (Array.isArray(anims) ? anims : []).filter((name) =>
          String(name).toLowerCase().includes(q)
        );
      }

      if (useAnims.length) {
        if (!filenameAdded) {
          result[filename] = {};
          filenameAdded = true;
        }
        result[filename][groupKey] = useAnims;
      }
    }
  }

  return result;
}

function AnimationTree({ tree, selected, onSelect }) {
  const filenames = Object.keys(tree).sort();

  if (!filenames.length) {
    return (
      <div className="px-3 py-2 text-xs text-slate-500">
        Loading animations…
      </div>
    );
  }

  return (
    <ul className="space-y-1 px-1 pb-3">
      {filenames.map((filename) => (
        <FilenameNode
          key={filename}
          filename={filename}
          groups={tree[filename]}
          selected={selected}
          onSelect={onSelect}
        />
      ))}
    </ul>
  );
}

function FilenameNode({ filename, groups, selected, onSelect }) {
  const [open, setOpen] = useState(false);

  const isActive = selected && selected.filename === filename;

  const groupKeys = Object.keys(groups).sort();

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={classNames(
          "flex w-full items-center gap-1 rounded-md px-2 py-1 text-xs",
          "hover:bg-slate-800/70",
          isActive && "bg-slate-800 text-sky-300"
        )}
      >
        <span className="h-3 w-3 flex items-center justify-center">
          {open ? (
            <ChevronDownIcon className="h-3 w-3" />
          ) : (
            <ChevronRightIcon className="h-3 w-3" />
          )}
        </span>
        <span className="truncate">{filename}</span>
      </button>

      {open && (
        <ul className="mt-1 space-y-0.5 pl-4">
          {groupKeys.map((groupKey) => (
            <GroupNode
              key={groupKey}
              filename={filename}
              groupKey={groupKey}
              animations={groups[groupKey]}
              selected={selected}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function GroupNode({ filename, groupKey, animations, selected, onSelect }) {
  const [open, setOpen] = useState(false);

  const isInPath =
    selected &&
    selected.filename === filename &&
    selected.groupKey === groupKey;

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={classNames(
          "flex w-full items-center gap-1 rounded-md px-2 py-1 text-xs",
          "hover:bg-slate-800/70",
          isInPath && "bg-slate-800 text-sky-300"
        )}
      >
        <span className="h-3 w-3 flex items-center justify-center">
          {open ? (
            <ChevronDownIcon className="h-3 w-3" />
          ) : (
            <ChevronRightIcon className="h-3 w-3" />
          )}
        </span>
        <span className="truncate">{groupKey}</span>
      </button>

      {open && (
        <ul className="mt-1 space-y-0.5 pl-4">
          {animations.map((animName) => {
            const isSelected =
              selected &&
              selected.filename === filename &&
              selected.groupKey === groupKey &&
              selected.animName === animName;

            const inPath =
              selected &&
              selected.filename === filename &&
              selected.groupKey === groupKey &&
              !isSelected;

            return (
              <li key={animName}>
                <button
                  type="button"
                  onClick={() => onSelect({ filename, groupKey, animName })}
                  className={classNames(
                    "flex w-full items-center rounded-md px-2 py-0.5 text-xs",
                    "hover:bg-slate-800/70",
                    isSelected && "bg-sky-600 text-white",
                    !isSelected && inPath && "text-sky-300"
                  )}
                >
                  <span className="truncate">{animName}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

export default function AnimDatabase() {
  const [animData, setAnimData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");
  const [fileData, setFileData] = useState(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [selectedFrameIndex, setSelectedFrameIndex] = useState(0);

  useEffect(() => {
    async function loadAll() {
      try {
        const anims = await fetch(`${host}/game/animData`).then((res) =>
          res.json()
        );
        setAnimData(anims);
      } catch (err) {
        console.error(err);
      }
    }
    loadAll();
  }, []);

  const fileUrl =
    selected && selected.filename && selected.groupKey && selected.animName
      ? `${host}/game/animDataFile/${encodeURIComponent(
          selected.filename
        )}/${encodeURIComponent(selected.groupKey)}/${encodeURIComponent(
          selected.animName
        )}`
      : null;

  useEffect(() => {
    if (!fileUrl) {
      setFileData(null);
      setFileLoading(false);
      setSelectedFrameIndex(0);
      return;
    }

    let cancelled = false;
    setFileLoading(true);
    setSelectedFrameIndex(0);

    async function loadFile() {
      try {
        const res = await fetch(fileUrl);
        const json = await res.json();
        if (cancelled) return;
        setFileData(json);
        setFileLoading(false);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setFileData(null);
          setFileLoading(false);
        }
      }
    }

    loadFile();

    return () => {
      cancelled = true;
    };
  }, [fileUrl]);

  let baseData = null;
  let frameList = null;

  if (fileData && typeof fileData === "object") {
    const { frames, data: unusedData, ...rest } = fileData;
    baseData = rest;
    if (Array.isArray(frames)) {
      frameList = frames;
    }
  }

  let currentFrame = null;
  if (frameList && frameList.length) {
    const clampedIndex = Math.min(
      Math.max(selectedFrameIndex, 0),
      frameList.length - 1
    );
    if (clampedIndex !== selectedFrameIndex) {
      currentFrame = frameList[clampedIndex];
    } else {
      currentFrame = frameList[selectedFrameIndex];
    }
  }

  let bonesList = null;
  if (currentFrame && typeof currentFrame === "object") {
    const rawBones = currentFrame.bones;
    if (Array.isArray(rawBones)) {
      bonesList = rawBones;
    } else if (rawBones && typeof rawBones === "object") {
      bonesList = Object.values(rawBones);
    }
  }

  const tree = useMemo(() => normalizeAnimData(animData), [animData]);
  const filteredTree = useMemo(() => filterTree(tree, query), [tree, query]);

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-100">
      <aside className=" w-80 border-r border-slate-800 bg-slate-900/80 flex flex-col">
        <div className="max-h-96 flex flex-col">
          <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Animations
          </div>

          <div className="px-3 pb-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search filename, index, animation…"
              className="w-full rounded-md border border-slate-700 bg-slate-950/80 px-2 py-1 text-xs placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <div className="flex-1 overflow-y-auto bg-slate-950/80">
            <AnimationTree
              tree={filteredTree}
              selected={selected}
              onSelect={setSelected}
            />
          </div>
        </div>
        <div className="flex-1 border-t border-slate-800 bg-slate-950/80 overflow-y-auto px-3 py-2 text-xs space-y-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Selected
            </div>
            {selected ? (
              <div className="mt-1 rounded-md border border-slate-800 bg-slate-900/80 px-2 py-1.5 space-y-1">
                <div className="truncate text-[11px] text-slate-100">
                  {selected.animName}
                </div>
                <div className="text-[10px] text-slate-400">
                  <span className="block truncate">{selected.filename}</span>
                  <span className="block truncate">{selected.groupKey}</span>
                </div>
              </div>
            ) : (
              <div className="mt-1 text-[11px] text-slate-500">
                No animation selected
              </div>
            )}
          </div>
          {baseData && (
            <div>
              <div className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                File Info
              </div>
              <div className="mt-1 rounded-md border border-slate-800 bg-slate-900/80 px-2 py-2 space-y-1">
                {Object.entries(baseData).map(([key, value]) => (
                  <div key={key} className="flex justify-between gap-2">
                    <div className="text-slate-400">{key}</div>
                    <div className="text-right text-slate-100 break-words">
                      {typeof value === "object"
                        ? JSON.stringify(value)
                        : String(value)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 flex">
        <section className="flex-1 border-r border-slate-800 bg-slate-950/80 flex items-center justify-center">
          {!selected && (
            <div className="text-xs text-slate-500">Select an animation</div>
          )}
          {selected && fileLoading && (
            <div className="text-xs text-slate-500">Loading animation…</div>
          )}
          {selected && !fileLoading && (
            <div className="text-xs text-slate-500">
              Canvas placeholder for SVGs
            </div>
          )}
        </section>

        <section className="w-96 bg-slate-900/80 flex flex-col border-l border-slate-800">
          <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Frame Data
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-3 text-xs">
            {!selected && (
              <div className="text-slate-500">Select an animation</div>
            )}
            {selected && fileLoading && (
              <div className="text-slate-500">Loading data…</div>
            )}
            {selected && !fileLoading && !fileData && (
              <div className="text-slate-500">No data loaded</div>
            )}
            {selected && !fileLoading && fileData && (
              <>
                {frameList && frameList.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">
                        Frame{" "}
                        {Math.min(
                          Math.max(selectedFrameIndex, 0),
                          frameList.length - 1
                        )}
                      </div>
                      <select
                        value={Math.min(
                          Math.max(selectedFrameIndex, 0),
                          frameList.length - 1
                        )}
                        onChange={(e) =>
                          setSelectedFrameIndex(Number(e.target.value))
                        }
                        className="border border-slate-700 bg-slate-950/80 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                      >
                        {frameList.map((_, index) => (
                          <option key={index} value={index}>
                            {index}
                          </option>
                        ))}
                      </select>
                    </div>
                    {currentFrame && (
                      <div className="mt-2">
                        {bonesList && bonesList.length ? (
                          <ul className="space-y-1">
                            {bonesList.map((bone, index) => (
                              <li key={index}>
                                <div className="rounded-md border border-slate-800 bg-slate-950/80 px-2 py-1.5">
                                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-100">
                                    <span>Bone #{index}</span>
                                  </div>
                                  <dl className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px]">
                                    {[
                                      "id",
                                      "frame",
                                      "opacity",
                                      "x",
                                      "y",
                                      "scaleX",
                                      "scaleY",
                                      "rotateSkew0",
                                      "rotateSkew1",
                                    ].map(
                                      (field) =>
                                        bone[field] !== undefined && (
                                          <div
                                            key={field}
                                            className="flex justify-between gap-1"
                                          >
                                            <dt className="text-slate-400">
                                              {field}
                                            </dt>
                                            <dd className="text-right text-slate-100 break-words">
                                              {String(bone[field])}
                                            </dd>
                                          </div>
                                        )
                                    )}
                                  </dl>
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="text-[11px] text-slate-500">
                            No bones data in this frame
                          </div>
                        )}
                      </div>
                    )}
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
