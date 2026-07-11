import React, { useState, useEffect } from "react";
import { NodeType } from "../../core/simulation/types";
import {
  Plus,
  ArrowDownToLine,
  Cpu,
  ArrowUpFromLine,
  Layers,
  Divide,
  FastForward,
  Wrench,
  Truck,
  Scissors,
  GitMerge,
  Star,
  Search,
  ChevronDown,
  ChevronRight,
  Sparkles
} from "lucide-react";

interface ObjectLibraryProps {
  onAddNode: (type: NodeType) => void;
}

interface ObjectItem {
  type: NodeType;
  name: string;
  desc: string;
  icon: React.ReactNode;
  color: string;
}

export default function ObjectLibrary({ onAddNode }: ObjectLibraryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [favorites, setFavorites] = useState<NodeType[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    favorites: true,
    process: true,
    handling: true,
    resources: true
  });

  // Load favorites from local storage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("novasim_library_favorites");
      if (saved) {
        setFavorites(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to load favorites", e);
    }
  }, []);

  // Save favorites
  const toggleFavorite = (type: NodeType, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const updated = favorites.includes(type)
      ? favorites.filter((f) => f !== type)
      : [...favorites, type];
    setFavorites(updated);
    try {
      localStorage.setItem("novasim_library_favorites", JSON.stringify(updated));
    } catch (err) {
      console.error("Failed to save favorites", err);
    }
  };

  const objects: ObjectItem[] = [
    {
      type: "source",
      name: "Source / Generator",
      desc: "Generates simulation entities (stochastic or constant arrivals)",
      icon: <ArrowUpFromLine className="w-4 h-4 text-emerald-400" />,
      color: "border-emerald-950/60 hover:border-emerald-500 bg-emerald-950/10 text-emerald-300"
    },
    {
      type: "queue",
      name: "Buffer / Queue",
      desc: "Storage buffer lines when downstream resources are busy",
      icon: <Layers className="w-4 h-4 text-amber-400" />,
      color: "border-amber-950/60 hover:border-amber-500 bg-amber-950/10 text-amber-300"
    },
    {
      type: "processor",
      name: "Machine / Process",
      desc: "Capacity-constrained processing stations (machines, cells)",
      icon: <Cpu className="w-4 h-4 text-indigo-400" />,
      color: "border-indigo-950/60 hover:border-indigo-500 bg-indigo-950/10 text-indigo-300"
    },
    {
      type: "conveyor",
      name: "Conveyor Belt",
      desc: "Transports entities across a physical length with finite speed",
      icon: <FastForward className="w-4 h-4 text-cyan-400" />,
      color: "border-cyan-950/60 hover:border-cyan-500 bg-cyan-950/10 text-cyan-300"
    },
    {
      type: "resource",
      name: "Shared Resource",
      desc: "Pool of workers, tools, or spaces needed by processors",
      icon: <Wrench className="w-4 h-4 text-fuchsia-400" />,
      color: "border-fuchsia-950/60 hover:border-fuchsia-500 bg-fuchsia-950/10 text-fuchsia-300"
    },
    {
      type: "transporter",
      name: "Transporter / AGV",
      desc: "Mobile vehicles carrying batch loads between queue locations",
      icon: <Truck className="w-4 h-4 text-orange-400" />,
      color: "border-orange-950/60 hover:border-orange-500 bg-orange-950/10 text-orange-300"
    },
    {
      type: "separator",
      name: "Separator / Splitter",
      desc: "Splits bulk entities or unpacks batches into sub-units",
      icon: <Scissors className="w-4 h-4 text-pink-400" />,
      color: "border-pink-950/60 hover:border-pink-500 bg-pink-950/10 text-pink-300"
    },
    {
      type: "combiner",
      name: "Combiner / Packager",
      desc: "Assembles multiple entities together into a single batch or pallet",
      icon: <GitMerge className="w-4 h-4 text-violet-400" />,
      color: "border-violet-950/60 hover:border-violet-500 bg-violet-950/10 text-violet-300"
    },
    {
      type: "router",
      name: "Decision Router",
      desc: "Probability splits for sorting or branching process streams",
      icon: <Divide className="w-4 h-4 text-slate-400" />,
      color: "border-slate-800 hover:border-slate-500 bg-slate-900/40 text-slate-300"
    },
    {
      type: "sink",
      name: "Terminal / Sink",
      desc: "Removes entities from system and calculates cycle run KPIs",
      icon: <ArrowDownToLine className="w-4 h-4 text-red-400" />,
      color: "border-red-950/60 hover:border-red-500 bg-red-950/10 text-red-300"
    }
  ];

  const categories = [
    {
      id: "process",
      title: "Process Flow",
      types: ["source", "queue", "processor", "router", "sink"] as NodeType[]
    },
    {
      id: "handling",
      title: "Advanced Handling",
      types: ["conveyor", "separator", "combiner"] as NodeType[]
    },
    {
      id: "resources",
      title: "Execution Resources",
      types: ["resource", "transporter"] as NodeType[]
    }
  ];

  const toggleCategory = (id: string) => {
    setExpandedCategories((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredObjects = objects.filter(
    (obj) =>
      obj.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      obj.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
      obj.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const favoriteObjects = objects.filter((obj) => favorites.includes(obj.type));

  const renderObjectCard = (obj: ObjectItem) => {
    const isFav = favorites.includes(obj.type);
    return (
      <div
        key={obj.type}
        onClick={() => onAddNode(obj.type)}
        draggable={true}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", obj.type);
          e.dataTransfer.effectAllowed = "copy";
        }}
        className={`w-full text-left p-2.5 rounded-xl border flex gap-2.5 items-start transition-all cursor-grab active:cursor-grabbing group active:scale-[0.98] relative select-none ${obj.color}`}
      >
        <div className="p-1.5 rounded-lg bg-slate-900/80 border border-slate-800 shrink-0 group-hover:scale-105 transition-transform">
          {obj.icon}
        </div>
        <div className="flex-1 min-w-0 pr-6">
          <span className="text-[11px] font-bold font-mono tracking-tight text-slate-200 block truncate">
            {obj.name}
          </span>
          <p className="text-[9px] text-slate-500 mt-0.5 leading-normal font-sans group-hover:text-slate-400 transition-colors line-clamp-2">
            {obj.desc}
          </p>
        </div>

        {/* Favorite star */}
        <button
          onClick={(e) => toggleFavorite(obj.type, e)}
          className={`absolute right-2.5 top-2.5 p-1 rounded hover:bg-slate-900/60 transition-colors cursor-pointer ${
            isFav ? "text-yellow-400" : "text-slate-600 hover:text-slate-400"
          }`}
          title={isFav ? "Remove from Favorites" : "Add to Favorites"}
        >
          <Star className="w-3 h-3" fill={isFav ? "currentColor" : "none"} />
        </button>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-950/40 p-3.5 border-r border-slate-900 w-full lg:w-72 overflow-y-auto">
      {/* Title & Desc */}
      <div className="mb-3.5">
        <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          Simulation Objects
        </h3>
        <p className="text-[10px] text-slate-500 font-mono mt-1">
          Drag to layout or click to spawn. Customize scale and orientation.
        </p>
      </div>

      {/* Search Input */}
      <div className="relative mb-3.5">
        <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-slate-500">
          <Search className="w-3.5 h-3.5" />
        </span>
        <input
          type="text"
          placeholder="Search objects..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-slate-900/60 border border-slate-800 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
        />
      </div>

      <div className="space-y-3.5 flex-1">
        {/* If searching, show matching items directly */}
        {searchQuery.trim() !== "" ? (
          <div className="space-y-2">
            <span className="block text-[8px] font-mono uppercase text-indigo-400 font-bold tracking-wider mb-1">
              Search Results ({filteredObjects.length})
            </span>
            {filteredObjects.length > 0 ? (
              filteredObjects.map((obj) => renderObjectCard(obj))
            ) : (
              <p className="text-[10px] text-slate-600 font-mono text-center py-4">No matching objects found.</p>
            )}
          </div>
        ) : (
          <>
            {/* Favorites Category (only visible if there are favorites) */}
            {favoriteObjects.length > 0 && (
              <div className="border border-yellow-950/20 rounded-xl overflow-hidden bg-yellow-950/5">
                <button
                  onClick={() => toggleCategory("favorites")}
                  className="w-full flex items-center justify-between p-2.5 bg-yellow-950/10 border-b border-yellow-950/20 text-yellow-500 font-mono text-[9px] font-bold uppercase tracking-wider text-left"
                >
                  <span className="flex items-center gap-1.5">
                    <Star className="w-3 h-3" fill="currentColor" />
                    Favorites ({favoriteObjects.length})
                  </span>
                  {expandedCategories.favorites ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
                {expandedCategories.favorites && (
                  <div className="p-2.5 space-y-2 bg-slate-950/30">
                    {favoriteObjects.map((obj) => renderObjectCard(obj))}
                  </div>
                )}
              </div>
            )}

            {/* Structured categories */}
            {categories.map((cat) => {
              const catObjects = filteredObjects.filter((obj) => cat.types.includes(obj.type));
              if (catObjects.length === 0) return null;

              return (
                <div key={cat.id} className="border border-slate-900 rounded-xl overflow-hidden bg-slate-900/10">
                  <button
                    onClick={() => toggleCategory(cat.id)}
                    className="w-full flex items-center justify-between p-2.5 bg-slate-900/30 border-b border-slate-900 text-slate-400 font-mono text-[9px] font-semibold uppercase tracking-wider text-left"
                  >
                    <span>
                      {cat.title} ({catObjects.length})
                    </span>
                    {expandedCategories[cat.id] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  </button>
                  {expandedCategories[cat.id] && (
                    <div className="p-2 bg-slate-950/30 space-y-2">
                      {catObjects.map((obj) => renderObjectCard(obj))}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Embedded Quick Tips */}
      <div className="mt-4 border-t border-slate-900 pt-3.5 bg-slate-900/10 p-2.5 rounded-lg border border-slate-950">
        <h4 className="text-[9px] font-mono text-slate-500 uppercase font-bold">Topology Setup</h4>
        <ul className="list-disc pl-3 text-[9px] font-mono text-slate-600 mt-1 space-y-1">
          <li>Standard flow: <b className="text-emerald-500">Source</b> → <b className="text-amber-500">Queue</b> → <b className="text-indigo-500">Processor</b> → <b className="text-red-500">Sink</b>.</li>
          <li>Click left/right edge circular ports to draw interconnect process flow lines.</li>
          <li>Drag corners of selected nodes to resize, or pull top stem handle to rotate.</li>
        </ul>
      </div>
    </div>
  );
}
