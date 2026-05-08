import React from "react";

interface Zone {
  id: string;
  name: string;
  color: string;
  basePrice: number;
}

interface Props {
  zones: Zone[];
  selectedZoneId?: string | null;
  hoveredZone?: string | null;
  onSelectZone: (zoneId: string) => void;
  onHoverZone: (zoneId: string | null) => void;
}

export function AutodromoAHRMap({ zones, selectedZoneId, hoveredZone, onSelectZone, onHoverZone }: Props) {
  const findZone = (keywords: string[]): Zone | undefined => {
    return zones.find(z => {
      const name = z.name.toLowerCase();
      return keywords.some(k => name.includes(k.toLowerCase()));
    });
  };

  const Grada = ({ 
    x, y, w, h,
    keywords, 
    label,
    defaultColor,
    fontSize = 4,
    rotate = 0
  }: { 
    x: number; y: number; w: number; h: number;
    keywords: string[]; 
    label: string;
    defaultColor: string;
    fontSize?: number;
    rotate?: number;
  }) => {
    const zone = findZone(keywords) || zones[0];
    const isSelected = zone && selectedZoneId === zone.id;
    const isHovered = zone && hoveredZone === zone.id;
    const color = zone?.color || defaultColor;
    const cx = x + w/2;
    const cy = y + h/2;
    
    return (
      <g 
        onClick={() => zone && onSelectZone(zone.id)}
        onMouseEnter={() => zone && onHoverZone(zone.id)}
        onMouseLeave={() => onHoverZone(null)}
        className="cursor-pointer"
      >
        <rect
          x={x} y={y} width={w} height={h}
          fill={color}
          fillOpacity={isSelected ? 1 : isHovered ? 0.9 : 0.75}
          stroke={isSelected ? "#1e293b" : "#94a3b8"}
          strokeWidth={isSelected ? 1.2 : 0.4}
          className="transition-all duration-75"
        />
        <text
          x={cx}
          y={cy + 1.5}
          textAnchor="middle"
          fontSize={fontSize}
          fontWeight="500"
          fill="#374151"
          transform={rotate ? `rotate(${rotate} ${cx} ${cy})` : undefined}
          className="pointer-events-none select-none"
        >
          {label}
        </text>
      </g>
    );
  };

  // Colors from StubHub F1 map
  const lightBlue = "#bfdbfe";  // Grada 1, 2, 2A
  const peach = "#fed7aa";      // Grada 3A, 3, 4, 5, 5A, 6, etc.
  const pink = "#fecdd3";       // Grada 14 (Foro Sol Sur)
  const lightCyan = "#a5f3fc";  // Grada 15 (Foro Sol Norte)
  const yellow = "#fef08a";     // Grada 7, 8
  const cream = "#fef3c7";      // Grada 9, 10, 11
  const gray = "#e5e7eb";       // Suite areas

  return (
    <svg viewBox="0 0 480 380" className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
      {/* Background */}
      <rect x="0" y="0" width="480" height="380" fill="#f8fafc"/>
      
      {/* ============ TRACK OUTLINE ============ */}
      <path 
        d="M 75 65 
           L 280 65
           Q 305 65, 330 75
           L 370 95
           Q 395 108, 410 135
           L 420 165
           Q 428 195, 415 225
           L 385 275
           Q 365 310, 320 330
           L 260 348
           Q 210 360, 160 345
           L 95 315
           Q 55 295, 50 250
           L 50 145
           Q 48 100, 75 65
           Z"
        fill="none"
        stroke="#4b5563"
        strokeWidth="6"
      />
      
      {/* Track inner (gray tarmac) */}
      <path 
        d="M 95 85 
           L 270 85
           Q 290 85, 310 93
           L 345 110
           Q 365 120, 380 142
           L 390 168
           Q 398 192, 388 215
           L 362 260
           Q 345 290, 305 305
           L 250 320
           Q 205 330, 165 320
           L 112 295
           Q 80 280, 75 245
           L 75 150
           Q 73 115, 95 85
           Z"
        fill="#e5e7eb"
        stroke="#d1d5db"
        strokeWidth="1"
      />
      
      {/* Turn numbers */}
      <text x="95" y="80" fontSize="5" fill="#6b7280" fontWeight="bold">17</text>
      <text x="310" y="78" fontSize="5" fill="#6b7280" fontWeight="bold">1</text>
      <text x="385" y="108" fontSize="5" fill="#6b7280" fontWeight="bold">2</text>
      <text x="405" y="148" fontSize="5" fill="#6b7280" fontWeight="bold">3</text>
      <text x="395" y="225" fontSize="5" fill="#6b7280" fontWeight="bold">5b</text>
      <text x="355" y="280" fontSize="5" fill="#6b7280" fontWeight="bold">8</text>
      <text x="280" y="332" fontSize="5" fill="#6b7280" fontWeight="bold">9</text>
      <text x="180" y="345" fontSize="5" fill="#6b7280" fontWeight="bold">10</text>
      <text x="90" y="305" fontSize="5" fill="#6b7280" fontWeight="bold">11</text>
      <text x="60" y="225" fontSize="5" fill="#6b7280" fontWeight="bold">12</text>
      <text x="90" y="120" fontSize="5" fill="#6b7280" fontWeight="bold">13</text>
      <text x="105" y="95" fontSize="5" fill="#6b7280" fontWeight="bold">14</text>
      <text x="135" y="85" fontSize="5" fill="#6b7280" fontWeight="bold">15</text>
      <text x="175" y="80" fontSize="5" fill="#6b7280" fontWeight="bold">16</text>
      
      {/* Start/Finish line marker */}
      <line x1="285" y1="68" x2="285" y2="82" stroke="#000" strokeWidth="2"/>
      <text x="290" y="60" fontSize="4" fill="#333">▶▶▶</text>
      
      {/* ============ TOP GRADAS (1, 2, 2A, 3A, 3, 4) ============ */}
      <Grada x={75} y={38} w={48} h={18} keywords={["grada 1", "1"]} label="GRADA 1" defaultColor={lightBlue} fontSize={5}/>
      <Grada x={128} y={38} w={48} h={18} keywords={["grada 2", "2"]} label="GRADA 2" defaultColor={lightBlue} fontSize={5}/>
      <Grada x={210} y={38} w={48} h={18} keywords={["grada 2a", "2a"]} label="GRADA 2A" defaultColor={lightBlue} fontSize={5}/>
      <Grada x={285} y={38} w={32} h={18} keywords={["grada 3a", "3a"]} label="GRADA 3A" defaultColor={peach} fontSize={4}/>
      <Grada x={320} y={38} w={18} h={18} keywords={["grada 3", "3"]} label="3" defaultColor={peach} fontSize={5}/>
      <Grada x={342} y={38} w={36} h={18} keywords={["grada 4", "4"]} label="GRADA 4" defaultColor={peach} fontSize={5}/>
      
      {/* ============ RIGHT SIDE GRADAS (5, 5A, 5B, 6, 6A, 6B) ============ */}
      <Grada x={400} y={72} w={18} h={28} keywords={["grada 5", "5"]} label="5" defaultColor={peach} fontSize={5} rotate={90}/>
      <Grada x={400} y={102} w={18} h={22} keywords={["grada 5a", "5a"]} label="5A" defaultColor={peach} fontSize={4} rotate={90}/>
      <Grada x={380} y={60} w={16} h={16} keywords={["grada 5b", "5b"]} label="5B" defaultColor={gray} fontSize={3.5}/>
      
      <Grada x={420} y={135} w={18} h={28} keywords={["grada 6", "6"]} label="6" defaultColor={peach} fontSize={5} rotate={90}/>
      <Grada x={420} y={195} w={18} h={28} keywords={["grada 6a", "6a"]} label="6A" defaultColor={peach} fontSize={4} rotate={90}/>
      <Grada x={400} y={165} w={16} h={22} keywords={["grada 6b", "6b"]} label="6B" defaultColor={peach} fontSize={3.5} rotate={90}/>
      
      {/* ============ BOTTOM RIGHT GRADAS (7, 8, 9) ============ */}
      <Grada x={395} y={250} w={28} h={18} keywords={["grada 7", "7"]} label="GRADA 7" defaultColor={yellow} fontSize={4}/>
      <Grada x={350} y={285} w={40} h={16} keywords={["grada 8", "8"]} label="GRADA 8" defaultColor={yellow} fontSize={4} rotate={-25}/>
      <Grada x={300} y={310} w={40} h={18} keywords={["grada 9", "9"]} label="GRADA 9" defaultColor={cream} fontSize={4}/>
      
      {/* ============ BOTTOM GRADAS (10, 11) ============ */}
      <Grada x={245} y={340} w={45} h={18} keywords={["grada 10", "10"]} label="GRADA 10" defaultColor={cream} fontSize={4}/>
      <Grada x={175} y={345} w={55} h={18} keywords={["grada 11", "11"]} label="GRADA 11" defaultColor={cream} fontSize={4}/>
      
      {/* ============ LEFT SIDE - FORO SOL ============ */}
      {/* Grada 14 (Foro Sol Sur) */}
      <g>
        <path 
          d="M 25 145 L 45 130 L 60 130 L 60 200 L 45 200 L 25 185 Z"
          fill={pink}
          fillOpacity={0.75}
          stroke="#94a3b8"
          strokeWidth="0.4"
          className="cursor-pointer transition-all duration-75"
          onClick={() => {
            const z = findZone(["grada 14", "foro sol sur", "14"]);
            if (z) onSelectZone(z.id);
          }}
          onMouseEnter={() => {
            const z = findZone(["grada 14", "foro sol sur", "14"]);
            if (z) onHoverZone(z.id);
          }}
          onMouseLeave={() => onHoverZone(null)}
        />
        <text x="42" y="155" fontSize="3.5" fill="#374151" fontWeight="500">GRADA 14</text>
        <text x="42" y="162" fontSize="3" fill="#374151">(FORO SOL SUR)</text>
      </g>
      
      {/* Grada 15 (Foro Sol Norte) */}
      <g>
        <path 
          d="M 70 85 L 95 75 L 95 130 L 70 130 Z"
          fill={lightCyan}
          fillOpacity={0.75}
          stroke="#94a3b8"
          strokeWidth="0.4"
          className="cursor-pointer transition-all duration-75"
          onClick={() => {
            const z = findZone(["grada 15", "foro sol norte", "15"]);
            if (z) onSelectZone(z.id);
          }}
          onMouseEnter={() => {
            const z = findZone(["grada 15", "foro sol norte", "15"]);
            if (z) onHoverZone(z.id);
          }}
          onMouseLeave={() => onHoverZone(null)}
        />
        <text x="82" y="95" fontSize="3" fill="#374151" fontWeight="500">GRADA 15</text>
        <text x="82" y="102" fontSize="2.5" fill="#374151">(FORO SOL NORTE)</text>
      </g>
      
      {/* Turn markers 13, 14, 15 */}
      <circle cx="75" y={110} r="4" fill="#f87171"/>
      <text x="75" y="112" textAnchor="middle" fontSize="3.5" fill="#fff" fontWeight="bold">15</text>
      
      <circle cx="88" cy="120" r="4" fill="#f87171"/>
      <text x="88" y="122" textAnchor="middle" fontSize="3.5" fill="#fff" fontWeight="bold">14</text>
      
      <circle cx="58" cy="135" r="4" fill="#f87171"/>
      <text x="58" y="137" textAnchor="middle" fontSize="3.5" fill="#fff" fontWeight="bold">13</text>
      
      <circle cx="48" cy="210" r="4" fill="#3b82f6"/>
      <text x="48" y="212" textAnchor="middle" fontSize="3.5" fill="#fff" fontWeight="bold">16</text>
      
      {/* ============ CENTER HOSPITALITY AREAS ============ */}
      <g>
        <rect x="180" y="160" width="90" height="35" fill={gray} fillOpacity="0.6" stroke="#94a3b8" strokeWidth="0.4"/>
        <text x="225" y="175" textAnchor="middle" fontSize="5" fill="#374151" fontWeight="500">SUITE PLATINO PLUS</text>
        <text x="225" y="185" textAnchor="middle" fontSize="4" fill="#6b7280">ZONA ROSA</text>
      </g>
      
      {/* ============ LEGEND ============ */}
      <g transform="translate(120, 290)">
        <rect x="0" y="0" width="200" height="55" fill="#fff" stroke="#e2e8f0" rx="3"/>
        
        <rect x="10" y="10" width="12" height="8" fill={gray}/>
        <text x="28" y="17" fontSize="4.5" fill="#333">VIP - Paddock Club</text>
        
        <rect x="110" y="10" width="12" height="8" fill="#c4b5fd"/>
        <text x="128" y="17" fontSize="4.5" fill="#333">Champions Club Hospitality</text>
        
        <rect x="10" y="25" width="12" height="8" fill="#86efac"/>
        <text x="28" y="32" fontSize="4.5" fill="#333">Paddock Club Hospitality</text>
        
        <rect x="110" y="25" width="12" height="8" fill="#bfdbfe"/>
        <text x="128" y="32" fontSize="4.5" fill="#333">Team Packages</text>
      </g>
    </svg>
  );
}
