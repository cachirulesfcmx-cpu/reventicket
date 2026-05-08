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

export function EstadioGNPMap({ zones, selectedZoneId, hoveredZone, onSelectZone, onHoverZone }: Props) {
  const findZone = (keywords: string[]): Zone | undefined => {
    return zones.find(z => {
      const name = z.name.toLowerCase();
      return keywords.some(k => name.includes(k.toLowerCase()));
    });
  };

  const Section = ({ 
    d, 
    keywords, 
    label,
    labelX, 
    labelY,
    defaultColor,
    fontSize = 4,
    rotate = 0
  }: { 
    d: string; 
    keywords: string[]; 
    label?: string;
    labelX: number;
    labelY: number;
    defaultColor: string;
    fontSize?: number;
    rotate?: number;
  }) => {
    const zone = findZone(keywords) || zones[0];
    const isSelected = zone && selectedZoneId === zone.id;
    const isHovered = zone && hoveredZone === zone.id;
    const color = zone?.color || defaultColor;
    
    return (
      <g 
        onClick={() => zone && onSelectZone(zone.id)}
        onMouseEnter={() => zone && onHoverZone(zone.id)}
        onMouseLeave={() => onHoverZone(null)}
        className="cursor-pointer"
      >
        <path
          d={d}
          fill={color}
          fillOpacity={isSelected ? 1 : isHovered ? 0.9 : 0.75}
          stroke={isSelected ? "#1e293b" : "#94a3b8"}
          strokeWidth={isSelected ? 1.2 : 0.3}
          className="transition-all duration-75"
        />
        {label && (
          <text
            x={labelX}
            y={labelY}
            textAnchor="middle"
            fontSize={fontSize}
            fontWeight="500"
            fill="#374151"
            transform={rotate ? `rotate(${rotate} ${labelX} ${labelY})` : undefined}
            className="pointer-events-none select-none"
          >
            {label}
          </text>
        )}
      </g>
    );
  };

  const Rect = ({ 
    x, y, w, h, 
    keywords, 
    label,
    defaultColor,
    fontSize = 3.5,
    rotate = 0
  }: { 
    x: number; y: number; w: number; h: number;
    keywords: string[]; 
    label?: string;
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
          strokeWidth={isSelected ? 1 : 0.25}
          className="transition-all duration-75"
        />
        {label && (
          <text
            x={cx}
            y={cy + 1}
            textAnchor="middle"
            fontSize={fontSize}
            fontWeight="500"
            fill="#374151"
            transform={rotate ? `rotate(${rotate} ${cx} ${cy})` : undefined}
            className="pointer-events-none select-none"
          >
            {label}
          </text>
        )}
      </g>
    );
  };

  // Colors matching StubHub
  const purple = "#d8b4fe";  // Platino
  const green = "#bbf7d0";   // VE sections
  const blue = "#bfdbfe";    // NA sections  
  const yellow = "#fef08a";  // GNP sections
  const lightBlue = "#e0f2fe"; // Side sections
  const floorGreen = "#86efac"; // 101-108

  return (
    <svg viewBox="0 0 400 340" className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
      {/* Background */}
      <rect x="0" y="0" width="400" height="340" fill="#f8fafc"/>
      
      {/* ============ CURVED TOP SECTION (NA - Blue) ============ */}
      {/* Top curve - NA sections */}
      <Section d="M 75 45 Q 75 15, 130 12 L 130 35 Q 90 38, 85 55 Z" 
        keywords={["na", "azul"]} label="" labelX={100} labelY={35} defaultColor={blue}/>
      
      {/* Top row NA sections */}
      <Rect x={80} y={22} w={18} h={16} keywords={["na"]} label="NA 24C" defaultColor={blue} fontSize={2.8}/>
      <Rect x={98} y={20} w={18} h={16} keywords={["na"]} label="NA 24B" defaultColor={blue} fontSize={2.8}/>
      <Rect x={116} y={18} w={18} h={16} keywords={["na"]} label="NA 25B" defaultColor={blue} fontSize={2.8}/>
      <Rect x={134} y={16} w={16} h={16} keywords={["na"]} label="NA 26A" defaultColor={blue} fontSize={2.8}/>
      <Rect x={150} y={14} w={16} h={16} keywords={["na"]} label="NA 26B" defaultColor={blue} fontSize={2.8}/>
      <Rect x={166} y={12} w={16} h={16} keywords={["na"]} label="NA 28C" defaultColor={blue} fontSize={2.8}/>
      <Rect x={182} y={11} w={16} h={16} keywords={["na"]} label="NA 30C" defaultColor={blue} fontSize={2.8}/>
      
      {/* Top center */}
      <Rect x={198} y={10} w={16} h={16} keywords={["na"]} label="NA 29C" defaultColor={blue} fontSize={2.8}/>
      <Rect x={214} y={11} w={16} h={16} keywords={["na"]} label="NA 27C" defaultColor={blue} fontSize={2.8}/>
      <Rect x={230} y={12} w={16} h={16} keywords={["na"]} label="NA 27B" defaultColor={blue} fontSize={2.8}/>
      <Rect x={246} y={14} w={16} h={16} keywords={["na"]} label="NA 27A" defaultColor={blue} fontSize={2.8}/>
      <Rect x={262} y={16} w={16} h={16} keywords={["na"]} label="NA 25A" defaultColor={blue} fontSize={2.8}/>
      <Rect x={278} y={18} w={18} h={16} keywords={["na"]} label="NA 23B" defaultColor={blue} fontSize={2.8}/>
      <Rect x={296} y={20} w={18} h={16} keywords={["na"]} label="NA 21B" defaultColor={blue} fontSize={2.8}/>
      <Rect x={314} y={22} w={18} h={16} keywords={["na"]} label="NA 21C" defaultColor={blue} fontSize={2.8}/>
      
      {/* Right curve */}
      <Section d="M 332 45 L 340 55 Q 345 38, 285 35 L 285 12 Q 340 15, 340 45 Z" 
        keywords={["na"]} label="" labelX={315} labelY={35} defaultColor={blue}/>
      
      {/* ============ SECOND ROW - VE sections (Green) ============ */}
      <Rect x={85} y={40} w={20} h={14} keywords={["ve-18"]} label="VE-18" defaultColor={green} fontSize={3}/>
      <Rect x={107} y={38} w={22} h={14} keywords={["ve-20"]} label="VE-20" defaultColor={green} fontSize={3}/>
      <Rect x={131} y={36} w={22} h={14} keywords={["ve-22"]} label="VE-22" defaultColor={green} fontSize={3}/>
      <Rect x={155} y={34} w={22} h={14} keywords={["ve-24"]} label="VE-24" defaultColor={green} fontSize={3}/>
      
      {/* Right VE */}
      <Rect x={233} y={34} w={22} h={14} keywords={["ve-23"]} label="VE-23" defaultColor={green} fontSize={3}/>
      <Rect x={257} y={36} w={22} h={14} keywords={["ve-21"]} label="VE-21" defaultColor={green} fontSize={3}/>
      <Rect x={281} y={38} w={22} h={14} keywords={["ve-19"]} label="VE-19" defaultColor={green} fontSize={3}/>
      <Rect x={305} y={40} w={20} h={14} keywords={["ve-17"]} label="VE-17" defaultColor={green} fontSize={3}/>
      
      {/* ============ THIRD ROW - VE continued ============ */}
      <Rect x={70} y={56} w={18} h={14} keywords={["ve-16"]} label="VE-16" defaultColor={green} fontSize={3}/>
      <Rect x={90} y={56} w={22} h={14} keywords={["ve-14"]} label="VE-14" defaultColor={green} fontSize={3}/>
      
      <Rect x={298} y={56} w={22} h={14} keywords={["ve-15"]} label="VE-15" defaultColor={green} fontSize={3}/>
      <Rect x={322} y={56} w={18} h={14} keywords={["ve-13"]} label="VE-13" defaultColor={green} fontSize={3}/>
      
      {/* ============ FOURTH ROW ============ */}
      <Rect x={55} y={72} w={16} h={14} keywords={["ve-12"]} label="VE-12" defaultColor={green} fontSize={3}/>
      <Rect x={73} y={72} w={22} h={14} keywords={["ve-10"]} label="VE-10" defaultColor={green} fontSize={3}/>
      
      <Rect x={315} y={72} w={22} h={14} keywords={["ve-11"]} label="VE-11" defaultColor={green} fontSize={3}/>
      <Rect x={339} y={72} w={16} h={14} keywords={["ve-9"]} label="VE-9" defaultColor={green} fontSize={3}/>
      
      {/* ============ LEFT SIDE - GNP sections (Yellow) ============ */}
      <Rect x={25} y={55} w={12} h={12} keywords={["gnp"]} label="GNP 08C" defaultColor={yellow} fontSize={2.2}/>
      <Rect x={38} y={55} w={12} h={12} keywords={["gnp"]} label="GNP 08B" defaultColor={yellow} fontSize={2.2}/>
      <Rect x={25} y={68} w={12} h={12} keywords={["gnp"]} label="GNP 06C" defaultColor={yellow} fontSize={2.2}/>
      <Rect x={38} y={68} w={12} h={12} keywords={["gnp"]} label="GNP 06B" defaultColor={yellow} fontSize={2.2}/>
      <Rect x={25} y={81} w={12} h={12} keywords={["gnp"]} label="GNP 04C" defaultColor={yellow} fontSize={2.2}/>
      <Rect x={38} y={81} w={12} h={12} keywords={["gnp"]} label="GNP 04B" defaultColor={yellow} fontSize={2.2}/>
      <Rect x={25} y={94} w={12} h={12} keywords={["gnp"]} label="GNP 02C" defaultColor={yellow} fontSize={2.2}/>
      <Rect x={38} y={94} w={12} h={12} keywords={["gnp"]} label="GNP 02B" defaultColor={yellow} fontSize={2.2}/>
      
      {/* D section */}
      <Rect x={52} y={88} w={14} h={22} keywords={["d", "general"]} label="D" defaultColor={lightBlue} fontSize={4}/>
      <Rect x={52} y={112} w={14} h={22} keywords={["c", "general"]} label="C" defaultColor={lightBlue} fontSize={4}/>
      
      {/* ============ RIGHT SIDE - GNP sections ============ */}
      <Rect x={360} y={55} w={12} h={12} keywords={["gnp"]} label="GNP 09C" defaultColor={yellow} fontSize={2.2}/>
      <Rect x={348} y={55} w={12} h={12} keywords={["gnp"]} label="GNP 09B" defaultColor={yellow} fontSize={2.2}/>
      <Rect x={360} y={68} w={12} h={12} keywords={["gnp"]} label="GNP 07C" defaultColor={yellow} fontSize={2.2}/>
      <Rect x={348} y={68} w={12} h={12} keywords={["gnp"]} label="GNP 07B" defaultColor={yellow} fontSize={2.2}/>
      <Rect x={360} y={81} w={12} h={12} keywords={["gnp"]} label="GNP 05C" defaultColor={yellow} fontSize={2.2}/>
      <Rect x={348} y={81} w={12} h={12} keywords={["gnp"]} label="GNP 05B" defaultColor={yellow} fontSize={2.2}/>
      <Rect x={360} y={94} w={12} h={12} keywords={["gnp"]} label="GNP 03C" defaultColor={yellow} fontSize={2.2}/>
      <Rect x={348} y={94} w={12} h={12} keywords={["gnp"]} label="GNP 03B" defaultColor={yellow} fontSize={2.2}/>
      
      {/* D section right */}
      <Rect x={334} y={88} w={14} h={22} keywords={["d"]} label="D" defaultColor={lightBlue} fontSize={4}/>
      <Rect x={334} y={112} w={14} h={22} keywords={["c"]} label="C" defaultColor={lightBlue} fontSize={4}/>
      
      {/* ============ PLATINO SECTIONS (Purple) ============ */}
      {/* Top Platino row */}
      <Rect x={115} y={52} w={22} h={14} keywords={["platino"]} label="P 22" defaultColor={purple} fontSize={3}/>
      <Rect x={139} y={50} w={22} h={14} keywords={["platino"]} label="P 48" defaultColor={purple} fontSize={3}/>
      <Rect x={163} y={48} w={20} h={14} keywords={["platino"]} label="P 42" defaultColor={purple} fontSize={3}/>
      
      <Rect x={227} y={48} w={20} h={14} keywords={["platino"]} label="P 40" defaultColor={purple} fontSize={3}/>
      <Rect x={249} y={50} w={22} h={14} keywords={["platino"]} label="P 12" defaultColor={purple} fontSize={3}/>
      <Rect x={273} y={52} w={22} h={14} keywords={["platino"]} label="P 39" defaultColor={purple} fontSize={3}/>
      
      {/* Second Platino row */}
      <Rect x={97} y={68} w={20} h={14} keywords={["platino"]} label="P 33" defaultColor={purple} fontSize={3}/>
      <Rect x={119} y={68} w={22} h={14} keywords={["platino"]} label="P 16" defaultColor={purple} fontSize={3}/>
      
      <Rect x={269} y={68} w={22} h={14} keywords={["platino"]} label="P 11" defaultColor={purple} fontSize={3}/>
      <Rect x={293} y={68} w={20} h={14} keywords={["platino"]} label="P 38" defaultColor={purple} fontSize={3}/>
      
      {/* Third Platino row */}
      <Rect x={80} y={84} w={18} h={14} keywords={["platino"]} label="P 34" defaultColor={purple} fontSize={3}/>
      <Rect x={100} y={84} w={22} h={14} keywords={["platino"]} label="P 30" defaultColor={purple} fontSize={3}/>
      <Rect x={124} y={84} w={20} h={16} keywords={["platino"]} label="P 2" defaultColor={purple} fontSize={3}/>
      
      <Rect x={266} y={84} w={20} h={16} keywords={["platino"]} label="P 1" defaultColor={purple} fontSize={3}/>
      <Rect x={288} y={84} w={22} h={14} keywords={["platino"]} label="P 31" defaultColor={purple} fontSize={3}/>
      <Rect x={312} y={84} w={18} h={14} keywords={["platino"]} label="P 37" defaultColor={purple} fontSize={3}/>
      
      {/* Fourth Platino row */}
      <Rect x={68} y={100} w={18} h={16} keywords={["platino"]} label="P 35" defaultColor={purple} fontSize={3}/>
      <Rect x={88} y={100} w={20} h={16} keywords={["platino"]} label="P 12" defaultColor={purple} fontSize={3}/>
      <Rect x={110} y={102} w={18} h={16} keywords={["platino"]} label="P 9" defaultColor={purple} fontSize={3}/>
      
      <Rect x={282} y={102} w={18} h={16} keywords={["platino"]} label="P 35" defaultColor={purple} fontSize={3}/>
      <Rect x={302} y={100} w={20} h={16} keywords={["platino"]} label="P 27" defaultColor={purple} fontSize={3}/>
      <Rect x={324} y={100} w={18} h={16} keywords={["platino"]} label="P 36" defaultColor={purple} fontSize={3}/>
      
      {/* Fifth row */}
      <Rect x={68} y={118} w={18} h={18} keywords={["platino"]} label="P 40" defaultColor={purple} fontSize={3}/>
      <Rect x={88} y={120} w={20} h={18} keywords={["platino"]} label="P 14" defaultColor={purple} fontSize={3}/>
      <Rect x={110} y={120} w={18} h={18} keywords={["platino"]} label="P 45" defaultColor={purple} fontSize={3}/>
      
      <Rect x={282} y={120} w={18} h={18} keywords={["platino"]} label="P 25" defaultColor={purple} fontSize={3}/>
      <Rect x={302} y={120} w={20} h={18} keywords={["platino"]} label="P 47" defaultColor={purple} fontSize={3}/>
      <Rect x={324} y={118} w={18} h={18} keywords={["platino"]} label="P 36" defaultColor={purple} fontSize={3}/>
      
      {/* ============ ESCENARIO (Stage) ============ */}
      <g>
        {/* Main stage */}
        <rect x="145" y="66" width="120" height="42" rx="2" fill="#e5e7eb" stroke="#9ca3af" strokeWidth="0.5"/>
        <text x="205" y="90" textAnchor="middle" fill="#6b7280" fontSize="7" fontWeight="bold">ESCENARIO</text>
        
        {/* Cross runways */}
        <polygon points="195,108 215,108 218,145 192,145" fill="#d1d5db" stroke="#9ca3af" strokeWidth="0.3"/>
        <polygon points="155,85 155,93 185,93 185,85" fill="#d1d5db" stroke="#9ca3af" strokeWidth="0.3"/>
        <polygon points="225,85 225,93 255,93 255,85" fill="#d1d5db" stroke="#9ca3af" strokeWidth="0.3"/>
        
        {/* Diamond shapes */}
        <polygon points="175,100 185,108 175,118 165,108" fill="#d1d5db" stroke="#9ca3af" strokeWidth="0.3"/>
        <polygon points="235,100 245,108 235,118 225,108" fill="#d1d5db" stroke="#9ca3af" strokeWidth="0.3"/>
      </g>
      
      {/* Platino around stage bottom */}
      <Rect x={130} y={110} w={22} h={16} keywords={["platino"]} label="P 44" defaultColor={purple} fontSize={3}/>
      <Rect x={154} y={115} w={18} h={16} keywords={["platino"]} label="P 46" defaultColor={purple} fontSize={3}/>
      
      <Rect x={238} y={115} w={18} h={16} keywords={["platino"]} label="P 41" defaultColor={purple} fontSize={3}/>
      <Rect x={258} y={110} w={22} h={16} keywords={["platino"]} label="P 25" defaultColor={purple} fontSize={3}/>
      
      {/* Bottom Platino rows */}
      <Rect x={130} y={130} w={22} h={18} keywords={["platino"]} label="P 3" defaultColor={purple} fontSize={3}/>
      <Rect x={154} y={135} w={20} h={18} keywords={["platino"]} label="P 40" defaultColor={purple} fontSize={3}/>
      <Rect x={176} y={140} w={22} h={18} keywords={["platino"]} label="P 4" defaultColor={purple} fontSize={3}/>
      
      <Rect x={212} y={140} w={22} h={18} keywords={["platino"]} label="P 5" defaultColor={purple} fontSize={3}/>
      <Rect x={236} y={135} w={20} h={18} keywords={["platino"]} label="P 6" defaultColor={purple} fontSize={3}/>
      <Rect x={258} y={130} w={22} h={18} keywords={["platino"]} label="P 7" defaultColor={purple} fontSize={3}/>
      
      {/* More bottom rows */}
      <Rect x={115} y={150} w={20} h={20} keywords={["platino"]} label="P 8" defaultColor={purple} fontSize={3}/>
      <Rect x={137} y={155} w={22} h={18} keywords={["platino"]} label="P 43" defaultColor={purple} fontSize={3}/>
      <Rect x={161} y={160} w={22} h={16} keywords={["platino"]} label="P 10" defaultColor={purple} fontSize={3}/>
      
      <Rect x={227} y={160} w={22} h={16} keywords={["platino"]} label="P 15" defaultColor={purple} fontSize={3}/>
      <Rect x={251} y={155} w={22} h={18} keywords={["platino"]} label="P 17" defaultColor={purple} fontSize={3}/>
      <Rect x={275} y={150} w={20} h={20} keywords={["platino"]} label="P 18" defaultColor={purple} fontSize={3}/>
      
      {/* ============ BOTTOM GREEN SECTIONS (101-108) ============ */}
      <Rect x={55} y={200} w={36} h={28} keywords={["108", "general"]} label="108" defaultColor={floorGreen} fontSize={6}/>
      <Rect x={93} y={200} w={36} h={28} keywords={["107", "general"]} label="107" defaultColor={floorGreen} fontSize={6}/>
      <Rect x={131} y={200} w={36} h={28} keywords={["106", "general"]} label="106" defaultColor={floorGreen} fontSize={6}/>
      <Rect x={169} y={200} w={36} h={28} keywords={["105", "general"]} label="105" defaultColor={floorGreen} fontSize={6}/>
      <Rect x={207} y={200} w={36} h={28} keywords={["104", "general"]} label="104" defaultColor={floorGreen} fontSize={6}/>
      <Rect x={245} y={200} w={36} h={28} keywords={["103", "general"]} label="103" defaultColor={floorGreen} fontSize={6}/>
      <Rect x={283} y={200} w={36} h={28} keywords={["102", "general"]} label="102" defaultColor={floorGreen} fontSize={6}/>
      <Rect x={321} y={200} w={36} h={28} keywords={["101", "general"]} label="101" defaultColor={floorGreen} fontSize={6}/>
      
      {/* BOXES PRO labels */}
      <text x="45" y="145" textAnchor="middle" fontSize="3" fill="#6b7280" transform="rotate(-90 45 145)">BOXES PRO</text>
      <text x="365" y="145" textAnchor="middle" fontSize="3" fill="#6b7280" transform="rotate(90 365 145)">GIRO 5050</text>
    </svg>
  );
}
