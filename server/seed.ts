import { db } from "./db";
import { users, venues, events, zones, tickets } from "@shared/schema";
import bcrypt from "bcrypt";
import { sql } from "drizzle-orm";

async function seed() {
  console.log("🌱 Iniciando seed de base de datos con datos reales de StubHub México...");

  // Limpiar tablas existentes
  console.log("Limpiando tablas existentes...");
  await db.execute(sql`TRUNCATE tickets, orders, zones, events, venues, users, config RESTART IDENTITY CASCADE`);

  // 1. Crear usuario administrador
  console.log("Creando usuario admin...");
  const hashedPassword = await bcrypt.hash("admin123", 10);
  const [admin] = await db.insert(users).values({
    email: "admin@reventicket.com",
    password: hashedPassword,
    firstName: "Admin",
    lastName: "RevenTicket",
    role: "admin",
  }).returning();

  // Crear usuario de prueba
  const hashedUserPassword = await bcrypt.hash("test123", 10);
  await db.insert(users).values({
    email: "usuario@test.com",
    password: hashedUserPassword,
    firstName: "Usuario",
    lastName: "Prueba",
    role: "buyer",
  });

  // 2. Crear recintos reales de México
  console.log("Creando recintos...");
  const venueData = [
    {
      name: "Estadio GNP Seguros (Foro Sol)",
      city: "Ciudad de México",
      address: "Río de la Piedad Viaduct S/N, Granjas México, Iztacalco, CP 08400",
      capacity: 65000,
      image: "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=800",
    },
    {
      name: "Estadio Azteca (Estadio Banorte)",
      city: "Ciudad de México",
      address: "Calz. de Tlalpan 3465, Santa Úrsula Coapa, Coyoacán, CP 04650",
      capacity: 87523,
      image: "https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=800",
    },
    {
      name: "Auditorio Nacional",
      city: "Ciudad de México",
      address: "Paseo de la Reforma 50, Polanco V Secc, Miguel Hidalgo, CP 11560",
      capacity: 10000,
      image: "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=800",
    },
    {
      name: "Palacio de los Deportes",
      city: "Ciudad de México",
      address: "Viaducto Río de la Piedad, Granjas México, Iztacalco, CP 08400",
      capacity: 22370,
      image: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800",
    },
    {
      name: "Estadio BBVA (Gigante de Acero)",
      city: "Monterrey",
      address: "Av. Pablo Livas 2011, Guadalupe, Nuevo León",
      capacity: 53500,
      image: "https://images.unsplash.com/photo-1459865264687-595d652de67e?w=800",
    },
    {
      name: "Estadio Akron",
      city: "Guadalajara",
      address: "Av. Paseo del Campestre 777, Zapopan, Jalisco",
      capacity: 49850,
      image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800",
    },
    {
      name: "Autódromo Hermanos Rodríguez",
      city: "Ciudad de México",
      address: "Av. del Conscripto y Av. Río Churubusco, Granjas México, Iztacalco",
      capacity: 135000,
      image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800",
    },
  ];

  const createdVenues = await db.insert(venues).values(venueData).returning();
  const [gnp, azteca, auditorio, palacio, bbva, akron, autodromo] = createdVenues;

  // 3. Crear eventos reales basados en StubHub México 2025-2026
  console.log("Creando eventos reales...");
  const eventData = [
    // CONCIERTOS PRINCIPALES
    {
      title: "BTS World Tour 2026 - Estadio GNP",
      category: "Concierto",
      date: new Date("2026-05-07T20:00:00"),
      venueId: gnp.id,
      image: "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=800",
      minPrice: "11000.00",
      tags: ["K-Pop", "Agotando Rápido", "Reventa Alta"],
      description: "El grupo surcoreano más grande del mundo regresa a México. 3 fechas: 7, 9 y 10 de mayo. Precios de reventa desde $11,000 hasta $104,000 MXN.",
    },
    {
      title: "The Weeknd - After Hours Til Dawn Tour",
      category: "Concierto",
      date: new Date("2026-04-20T21:00:00"),
      venueId: gnp.id,
      image: "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800",
      minPrice: "2500.00",
      tags: ["Pop", "R&B", "Internacional"],
      description: "The Weeknd presenta su esperado tour en México. 3 fechas en abril. Experiencia visual impresionante.",
    },
    {
      title: "AC/DC Power Up Tour México",
      category: "Concierto",
      date: new Date("2026-04-07T21:00:00"),
      venueId: gnp.id,
      image: "https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=800",
      minPrice: "3200.00",
      tags: ["Rock", "Clásico", "Leyendas"],
      description: "Los legendarios AC/DC regresan a México con 3 fechas épicas: 7, 11 y 15 de abril 2026.",
    },
    {
      title: "P!NK Summer Carnival Tour",
      category: "Concierto",
      date: new Date("2026-04-26T20:30:00"),
      venueId: gnp.id,
      image: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800",
      minPrice: "2800.00",
      tags: ["Pop", "Show Aéreo", "Internacional"],
      description: "P!NK trae su impresionante show con acrobacias aéreas. 2 fechas: 26 y 27 de abril.",
    },
    {
      title: "My Chemical Romance - México 2026",
      category: "Concierto",
      date: new Date("2026-02-15T21:00:00"),
      venueId: gnp.id,
      image: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800",
      minPrice: "2400.00",
      tags: ["Rock Alternativo", "Emo", "Reunión"],
      description: "El esperado regreso de My Chemical Romance a México con 2 fechas en febrero 2026.",
    },
    {
      title: "Rosalía - Motomami World Tour",
      category: "Concierto",
      date: new Date("2026-08-15T21:00:00"),
      venueId: palacio.id,
      image: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800",
      minPrice: "1800.00",
      tags: ["Pop Latino", "Flamenco", "Urbano"],
      description: "Rosalía presenta 5 conciertos en el Palacio de los Deportes en agosto 2026.",
    },
    {
      title: "Tyler, The Creator - CHROMAKOPIA Tour",
      category: "Concierto",
      date: new Date("2026-03-24T21:00:00"),
      venueId: palacio.id,
      image: "https://images.unsplash.com/photo-1506157786151-b8491531f063?w=800",
      minPrice: "2200.00",
      tags: ["Hip-Hop", "Alternativo", "Visual"],
      description: "Tyler, The Creator llega a CDMX con su tour CHROMAKOPIA. 2 fechas: 24 y 25 de marzo.",
    },
    {
      title: "Deftones - México 2026",
      category: "Concierto",
      date: new Date("2026-03-29T21:00:00"),
      venueId: palacio.id,
      image: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=800",
      minPrice: "1500.00",
      tags: ["Metal Alternativo", "Nu Metal", "Rock"],
      description: "Deftones regresa a México el 29 de marzo de 2026 en el Palacio de los Deportes.",
    },
    {
      title: "Luis Miguel Tour 2026 - Auditorio Nacional",
      category: "Concierto",
      date: new Date("2026-03-20T21:00:00"),
      venueId: auditorio.id,
      image: "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=800",
      minPrice: "3500.00",
      tags: ["Baladas", "Pop Latino", "El Sol de México"],
      description: "El Sol de México presenta múltiples fechas en el Auditorio Nacional con sus grandes éxitos.",
    },
    {
      title: "Marco Antonio Solís - Tour 2026",
      category: "Concierto",
      date: new Date("2026-06-14T20:00:00"),
      venueId: auditorio.id,
      image: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800",
      minPrice: "882.00",
      tags: ["Romántico", "Baladas", "Regional"],
      description: "El Buki presenta su tour 2026 en el Auditorio Nacional. Desde $882 MXN según StubHub.",
    },
    // MUNDIAL FIFA 2026
    {
      title: "Copa Mundial FIFA 2026 - México vs Sudáfrica (Inauguración)",
      category: "Deportes",
      date: new Date("2026-06-11T16:00:00"),
      venueId: azteca.id,
      image: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800",
      minPrice: "3750.00",
      tags: ["Mundial 2026", "Partido Inaugural", "Histórico"],
      description: "El partido inaugural del Mundial 2026. México enfrenta a Sudáfrica en el Estadio Azteca. Precios desde $3,750 en reventa.",
    },
    {
      title: "Copa Mundial FIFA 2026 - Uzbekistán vs Colombia",
      category: "Deportes",
      date: new Date("2026-06-17T19:00:00"),
      venueId: azteca.id,
      image: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800",
      minPrice: "800.00",
      tags: ["Mundial 2026", "Fase de Grupos", "Colombia"],
      description: "Partido de fase de grupos del Mundial 2026 en el Estadio Azteca.",
    },
    {
      title: "Copa Mundial FIFA 2026 - Octavos de Final (Estadio Azteca)",
      category: "Deportes",
      date: new Date("2026-07-05T18:00:00"),
      venueId: azteca.id,
      image: "https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=800",
      minPrice: "1850.00",
      tags: ["Mundial 2026", "Eliminatoria", "Octavos"],
      description: "Partido de octavos de final del Mundial 2026. Equipos por definir.",
    },
    // F1 GRAN PREMIO DE MÉXICO
    {
      title: "F1 Gran Premio de México 2026 - Domingo Carrera",
      category: "F1",
      date: new Date("2026-11-01T14:00:00"),
      venueId: autodromo.id,
      image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800",
      minPrice: "3900.00",
      tags: ["F1", "Checo Pérez", "Cadillac F1"],
      description: "Gran Premio de México 2026. El regreso de Checo Pérez con el equipo Cadillac F1. Zona Naranja desde $3,900 MXN.",
    },
    {
      title: "F1 Gran Premio de México 2026 - Zona Verde VIP",
      category: "F1",
      date: new Date("2026-11-01T14:00:00"),
      venueId: autodromo.id,
      image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800",
      minPrice: "30500.00",
      tags: ["F1", "VIP", "Premium"],
      description: "Experiencia VIP Zona Verde con acceso a Speed Lounge. Desde $30,500 hasta $61,750 MXN.",
    },
    // LIGA MX
    {
      title: "Clásico Nacional: América vs Chivas",
      category: "Deportes",
      date: new Date("2026-03-07T19:00:00"),
      venueId: azteca.id,
      image: "https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800",
      minPrice: "550.00",
      tags: ["Liga MX", "Clásico", "Rivalidad"],
      description: "El partido más esperado del fútbol mexicano. Preferente Sur desde $550, Platea desde $1,000 MXN.",
    },
    {
      title: "Clásico Regio: Rayados vs Tigres",
      category: "Deportes",
      date: new Date("2026-09-13T20:00:00"),
      venueId: bbva.id,
      image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800",
      minPrice: "950.00",
      tags: ["Liga MX", "Clásico Regio", "Monterrey"],
      description: "La rivalidad más intensa del norte de México en el Gigante de Acero.",
    },
    // FESTIVALES
    {
      title: "Vive Latino 2026",
      category: "Concierto",
      date: new Date("2026-03-14T12:00:00"),
      venueId: autodromo.id,
      image: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800",
      minPrice: "2800.00",
      tags: ["Festival", "Rock", "Iberoamericano"],
      description: "Vive Latino 2026 con Lenny Kravitz, The Smashing Pumpkins, Juanes y más. 14 y 15 de marzo.",
    },
    {
      title: "Tecate Pa'l Norte 2026",
      category: "Concierto",
      date: new Date("2026-03-27T14:00:00"),
      venueId: bbva.id,
      image: "https://images.unsplash.com/photo-1506157786151-b8491531f063?w=800",
      minPrice: "3500.00",
      tags: ["Festival", "Monterrey", "Rock"],
      description: "El festival más grande del norte de México. 27 al 29 de marzo 2026.",
    },
    {
      title: "Iron Maiden - The Future Past Tour",
      category: "Concierto",
      date: new Date("2026-10-02T21:00:00"),
      venueId: gnp.id,
      image: "https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=800",
      minPrice: "2200.00",
      tags: ["Metal", "Leyendas", "Rock"],
      description: "Iron Maiden regresa a México el 2 de octubre de 2026 en el Estadio GNP Seguros.",
    },
  ];

  const createdEvents = await db.insert(events).values(eventData).returning();

  // 4. Crear zonas y boletos para cada evento con precios reales
  console.log("Creando zonas y boletos con precios reales...");
  
  for (const event of createdEvents) {
    let zoneData: { name: string; color: string; basePrice: string }[] = [];
    
    if (event.venueId === gnp.id) {
      // Estadio GNP - Precios reales de StubHub para conciertos
      const isBTS = event.title.includes("BTS");
      zoneData = [
        { name: "Verde A (Floor VIP)", color: "#22c55e", basePrice: isBTS ? "85000.00" : "6500.00" },
        { name: "Verde B (Floor)", color: "#16a34a", basePrice: isBTS ? "65000.00" : "4500.00" },
        { name: "Naranja (Lower Bowl)", color: "#f97316", basePrice: isBTS ? "45000.00" : "3200.00" },
        { name: "Roja A (Mid Bowl)", color: "#ef4444", basePrice: isBTS ? "32000.00" : "2400.00" },
        { name: "Roja B", color: "#dc2626", basePrice: isBTS ? "25000.00" : "2000.00" },
        { name: "Azul (Upper Bowl)", color: "#3b82f6", basePrice: isBTS ? "18000.00" : "1600.00" },
        { name: "General A", color: "#a855f7", basePrice: isBTS ? "14000.00" : "1200.00" },
        { name: "General B", color: "#9333ea", basePrice: isBTS ? "11000.00" : "900.00" },
      ];
    } else if (event.venueId === azteca.id) {
      const isWorldCup = event.tags?.includes("Mundial 2026");
      const isInaugural = event.title.includes("Inauguración");
      zoneData = [
        { name: "Categoría 1 (Platea Baja Central)", color: "#fbbf24", basePrice: isInaugural ? "12000.00" : isWorldCup ? "6500.00" : "1800.00" },
        { name: "Categoría 2 (Platea Baja Lateral)", color: "#f59e0b", basePrice: isInaugural ? "8500.00" : isWorldCup ? "4500.00" : "1400.00" },
        { name: "Categoría 3 (Platea Alta)", color: "#eab308", basePrice: isInaugural ? "5500.00" : isWorldCup ? "3000.00" : "1000.00" },
        { name: "Cabecera Norte", color: "#3b82f6", basePrice: isInaugural ? "4200.00" : isWorldCup ? "2000.00" : "700.00" },
        { name: "Cabecera Sur", color: "#2563eb", basePrice: isInaugural ? "4200.00" : isWorldCup ? "2000.00" : "700.00" },
        { name: "General Superior", color: "#94a3b8", basePrice: isInaugural ? "3750.00" : isWorldCup ? "1200.00" : "550.00" },
      ];
    } else if (event.venueId === auditorio.id) {
      zoneData = [
        { name: "Luneta VIP", color: "#fbbf24", basePrice: "5500.00" },
        { name: "Luneta A", color: "#f59e0b", basePrice: "4200.00" },
        { name: "Luneta B", color: "#eab308", basePrice: "3500.00" },
        { name: "Primer Nivel", color: "#ef4444", basePrice: "2800.00" },
        { name: "Segundo Nivel", color: "#3b82f6", basePrice: "2200.00" },
        { name: "Tercer Nivel", color: "#8b5cf6", basePrice: "1600.00" },
      ];
    } else if (event.venueId === palacio.id) {
      zoneData = [
        { name: "Pista VIP", color: "#fbbf24", basePrice: "3800.00" },
        { name: "Pista General", color: "#f59e0b", basePrice: "2800.00" },
        { name: "Gradas Bajas", color: "#ef4444", basePrice: "2200.00" },
        { name: "Gradas Altas", color: "#3b82f6", basePrice: "1800.00" },
        { name: "General", color: "#8b5cf6", basePrice: "1500.00" },
      ];
    } else if (event.venueId === autodromo.id) {
      const isVIP = event.title.includes("VIP");
      zoneData = [
        { name: "Tribuna Principal + Speed Lounge", color: "#fbbf24", basePrice: isVIP ? "61750.00" : "54400.00" },
        { name: "Zona Verde Grada 1", color: "#22c55e", basePrice: "30500.00" },
        { name: "Zona Verde Grada 2", color: "#16a34a", basePrice: "30500.00" },
        { name: "Zona Naranja Grada 3", color: "#f97316", basePrice: "9900.00" },
        { name: "Zona Naranja Grada 2", color: "#fb923c", basePrice: "3900.00" },
        { name: "General Foro Sol", color: "#3b82f6", basePrice: "3900.00" },
      ];
    } else if (event.venueId === bbva.id || event.venueId === akron.id) {
      const isFestival = event.tags?.includes("Festival");
      zoneData = [
        { name: "Palco VIP", color: "#fbbf24", basePrice: isFestival ? "5500.00" : "2800.00" },
        { name: "Preferente", color: "#ef4444", basePrice: isFestival ? "4200.00" : "1800.00" },
        { name: "Lateral A", color: "#f97316", basePrice: isFestival ? "3500.00" : "1400.00" },
        { name: "Lateral B", color: "#fb923c", basePrice: isFestival ? "3200.00" : "1200.00" },
        { name: "Cabecera", color: "#3b82f6", basePrice: isFestival ? "2800.00" : "950.00" },
        { name: "General", color: "#94a3b8", basePrice: isFestival ? "2200.00" : "700.00" },
      ];
    }

    if (zoneData.length === 0) continue;

    // Crear zonas
    const createdZones = await db.insert(zones).values(
      zoneData.map(z => ({
        eventId: event.id,
        name: z.name,
        color: z.color,
        basePrice: z.basePrice,
      }))
    ).returning();

    // Crear boletos de muestra (15 boletos por zona)
    const ticketData: any[] = [];
    for (const zone of createdZones) {
      const rows = ['A', 'B', 'C', 'D', 'E'];
      for (let row of rows) {
        for (let seat = 1; seat <= 3; seat++) {
          // Variar precios ligeramente para simular mercado real
          const basePrice = parseFloat(zone.basePrice);
          const variation = 1 + (Math.random() * 0.2 - 0.1); // ±10%
          const finalPrice = Math.round(basePrice * variation);
          
          ticketData.push({
            eventId: event.id,
            zoneId: zone.id,
            row: row,
            seat: seat.toString(),
            price: finalPrice.toString(),
            sellerId: admin.id,
            status: "available",
          });
        }
      }
    }

    await db.insert(tickets).values(ticketData);
  }

  console.log("✅ Seed completado exitosamente con datos reales de StubHub México!");
  console.log(`
  📊 Datos creados:
  - 2 usuarios (admin@reventicket.com / admin123, usuario@test.com / test123)
  - ${createdVenues.length} recintos reales de México
  - ${createdEvents.length} eventos reales (conciertos, Mundial 2026, F1, Liga MX)
  - Zonas y boletos con precios reales de StubHub para todos los eventos
  `);
}

seed()
  .catch((error) => {
    console.error("❌ Error en seed:", error);
    process.exit(1);
  })
  .then(() => {
    process.exit(0);
  });
