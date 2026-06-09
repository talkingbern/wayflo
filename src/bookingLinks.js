// src/bookingLinks.js
// Deterministic deep link builder

function fmt(dateStr) {
  return dateStr ? dateStr.slice(0, 10) : "";
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function cityName(str) {
  return (str || "").split(",")[0].trim();
}

function isUSCity(str) {
  const s = (str || "").toLowerCase();
  return s.includes(", usa") || s.includes(", us") || s.includes(", united states") ||
    s.includes(", va") || s.includes(", ny") || s.includes(", ca") || s.includes(", tx") ||
    s.includes(", fl") || s.includes(", il") || s.includes(", pa") || s.includes(", ma") ||
    s.includes(", dc") || s.includes(", wa") || s.includes(", co") || s.includes(", or") ||
    s.includes(", ga") || s.includes(", nc") || s.includes(", nj");
}

function isEuropeanCity(str) {
  const s = (str || "").toLowerCase();
  const countries = ["uk", "france", "germany", "spain", "italy", "netherlands", "belgium",
    "portugal", "switzerland", "austria", "czech", "poland", "hungary", "croatia",
    "sweden", "norway", "denmark", "finland", "ireland", "scotland", "england"];
  return countries.some(c => s.includes(c));
}

// ── Transport links ───────────────────────────────────────────────────────────
function flightLink(from, to, date) {
  if (!from || !to) return null;
  const query = `Flights from ${cityName(from)} to ${cityName(to)}${date ? " on " + fmt(date) : ""}`;
  return {
    label: "Search flights on Google Flights",
    url: `https://www.google.com/travel/flights?q=${encodeURIComponent(query)}`,
  };
}

function trainLink(from, to) {
  if (!from || !to) return null;
  const f = cityName(from).toLowerCase().replace(/\s+/g, "-");
  const t = cityName(to).toLowerCase().replace(/\s+/g, "-");
  return {
    label: "Book train on Trainline",
    url: `https://www.trainline.com/search/${encodeURIComponent(f)}/${encodeURIComponent(t)}`,
  };
}

function amtrakLink(from, to, date) {
  if (!from || !to) return null;
  // Amtrak search — no station code deep link available publicly
  // but we can link to their search with a clean query
  const query = `${cityName(from)} to ${cityName(to)} Amtrak${date ? " " + fmt(date) : ""}`;
  return {
    label: "Search Amtrak trains",
    url: `https://www.amtrak.com/tickets/depart.html`,
  };
}

function rome2rioLink(from, to) {
  if (!from || !to) return null;
  const f = encodeURIComponent(cityName(from));
  const t = encodeURIComponent(cityName(to));
  return {
    label: `Search routes on Rome2Rio`,
    url: `https://www.rome2rio.com/s/${f}/${t}`,
  };
}

function ferryLink(from, to) {
  if (!from || !to) return null;
  const f = cityName(from).toLowerCase().replace(/\s+/g, "+");
  const t = cityName(to).toLowerCase().replace(/\s+/g, "+");
  return {
    label: "Find ferries on Direct Ferries",
    url: `https://www.directferries.co.uk/passenger_ferries.htm?from=${f}&to=${t}`,
  };
}

function driveLink(from, to) {
  if (!from || !to) return null;
  return {
    label: "Get driving directions",
    url: `https://www.google.com/maps/dir/${encodeURIComponent(from)}/${encodeURIComponent(to)}`,
  };
}

// ── Accommodation links ───────────────────────────────────────────────────────
function hostelLink(city, dateFrom, dateTo) {
  if (!city) return null;
  const c = cityName(city);
  // Use Google search as reliable fallback since Hostelworld URLs are unstable
  const query = `hostels in ${c}${dateFrom ? " " + fmt(dateFrom) : ""}`;
  return {
    label: `Find hostels in ${c}`,
    url: `https://www.google.com/search?q=${encodeURIComponent(query)}+hostelworld+booking`,
  };
}

function hotelLink(city, dateFrom, dateTo) {
  if (!city) return null;
  const c = cityName(city);
  const params = new URLSearchParams({
    ss: c,
    ...(dateFrom ? { checkin:  fmt(dateFrom) } : {}),
    ...(dateTo   ? { checkout: fmt(dateTo)   } : {}),
    group_adults: "1",
    no_rooms: "1",
  });
  return {
    label: `Browse accommodation on Booking.com`,
    url: `https://www.booking.com/searchresults.html?${params.toString()}`,
  };
}

// ── Main builder ──────────────────────────────────────────────────────────────
export function buildBookingLinks(day, { origin, destination, dateFrom, dateTo }) {
  const links  = [];
  const title   = (day.title   || "").toLowerCase();
  const content = (day.content || "").toLowerCase();
  const type    = (day.transportType || "").toLowerCase();

  const isGettingThere = title.includes("getting there") || title.includes("day 0");
  const isGettingHome  = title.includes("getting home")  || title.includes("departure");

  if (isGettingThere || isGettingHome) {
    const from = isGettingThere ? origin      : destination;
    const to   = isGettingThere ? destination : origin;
    const date = isGettingThere ? dateFrom    : dateTo;

    const isFlight = type === "flight" || (!type && (content.includes("fly") || content.includes("flight") || content.includes("airport")));
    const isTrain  = type === "train"  || (!type && (content.includes("train") || content.includes("rail") || content.includes("amtrak") || content.includes("eurostar")));
    const isFerry  = type === "ferry"  || content.includes("ferry");
    const isDrive  = type === "drive"  || (content.includes("drive") && !isTrain && !isFlight);
    const isBus    = type === "bus"    || content.includes("flixbus") || content.includes("coach");

    if (isFlight) {
      const link = flightLink(from, to, date);
      if (link) links.push(link);
    } else if (isTrain) {
      // Amtrak for US routes, Trainline for European, Rome2Rio for everything else
      if (content.includes("amtrak") || (isUSCity(from) && isUSCity(to))) {
        const link = amtrakLink(from, to, date);
        if (link) links.push(link);
      } else if (isEuropeanCity(from) || isEuropeanCity(to)) {
        const link = trainLink(from, to);
        if (link) links.push(link);
      } else {
        const link = rome2rioLink(from, to);
        if (link) links.push(link);
      }
      // Offer flight as alternative
      const flight = flightLink(from, to, date);
      if (flight) links.push({ ...flight, label: "Or search flights" });
    } else if (isFerry) {
      const link = ferryLink(from, to);
      if (link) links.push(link);
    } else if (isDrive) {
      const link = driveLink(from, to);
      if (link) links.push(link);
    } else if (isBus) {
      // No reliable bus deep links — use Rome2Rio
      const link = rome2rioLink(from, to);
      if (link) links.push(link);
    } else {
      // Unknown transport — offer Rome2Rio + flights
      const r2r    = rome2rioLink(from, to);
      const flight = flightLink(from, to, date);
      if (r2r)    links.push(r2r);
      if (flight) links.push(flight);
    }

    // Accommodation for arrival day
    if (isGettingThere) {
      const hostel = hostelLink(destination, dateFrom, dateTo);
      if (hostel) links.push(hostel);
    }
  }

  // Ferry links on non-travel days if content mentions ferries
  if (!isGettingThere && !isGettingHome && content.includes("ferry")) {
    links.push({ label: "Find ferries on Direct Ferries", url: "https://www.directferries.co.uk" });
  }

  return links;
}
