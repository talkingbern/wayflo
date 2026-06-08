// src/bookingLinks.js
// Deterministic deep link builder — takes structured trip data and returns
// real pre-filled URLs. Never relies on the AI to generate URLs.

function fmt(dateStr) {
  // Ensure YYYY-MM-DD format for URLs
  return dateStr ? dateStr.slice(0, 10) : "";
}

function encodeCity(city) {
  return encodeURIComponent((city || "").split(",")[0].trim());
}

// ── Transport links ───────────────────────────────────────────────────────────
function flightLink(from, to, date) {
  if (!from || !to) return null;
  const f = encodeURIComponent(from.split(",")[0].trim());
  const t = encodeURIComponent(to.split(",")[0].trim());
  const d = fmt(date).replace(/-/g, "");
  return {
    label: "Search flights on Google Flights",
    url: `https://www.google.com/travel/flights?q=Flights+from+${f}+to+${t}${d ? `+on+${d}` : ""}`,
  };
}

function trainLink(from, to, date) {
  if (!from || !to) return null;
  const f = encodeURIComponent(from.split(",")[0].trim().toLowerCase().replace(/\s+/g, "-"));
  const t = encodeURIComponent(to.split(",")[0].trim().toLowerCase().replace(/\s+/g, "-"));
  return {
    label: "Book train on Trainline",
    url: `https://www.trainline.com/search/${f}/${t}`,
  };
}

function busLink(from, to) {
  if (!from || !to) return null;
  return {
    label: "Find buses on FlixBus",
    url: `https://global.flixbus.com/bus-routes`,
  };
}

function ferryLink(from, to) {
  if (!from || !to) return null;
  const f = encodeURIComponent(from.split(",")[0].trim());
  const t = encodeURIComponent(to.split(",")[0].trim());
  return {
    label: "Find ferries on Direct Ferries",
    url: `https://www.directferries.com/search_results.htm?from_port=${f}&to_port=${t}`,
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
  const c = encodeCity(city);
  const params = new URLSearchParams({
    search_keywords: city.split(",")[0].trim(),
    ...(dateFrom ? { date_from: fmt(dateFrom) } : {}),
    ...(dateTo   ? { date_to:   fmt(dateTo)   } : {}),
    no_of_adults: "1",
  });
  return {
    label: `Find hostels in ${city.split(",")[0].trim()} on Hostelworld`,
    url: `https://www.hostelworld.com/search?${params.toString()}`,
  };
}

function hotelLink(city, dateFrom, dateTo) {
  if (!city) return null;
  const params = new URLSearchParams({
    ss: city.split(",")[0].trim(),
    ...(dateFrom ? { checkin:  fmt(dateFrom) } : {}),
    ...(dateTo   ? { checkout: fmt(dateTo)   } : {}),
    group_adults: "1",
  });
  return {
    label: `Browse hotels on Booking.com`,
    url: `https://www.booking.com/searchresults.html?${params.toString()}`,
  };
}

// ── Main builder ──────────────────────────────────────────────────────────────
// Generates booking links for each day based on transport type and context.
// origin/destination are city strings, dateFrom/dateTo are YYYY-MM-DD strings.
export function buildBookingLinks(day, { origin, destination, dateFrom, dateTo }) {
  const links = [];
  const title   = (day.title || "").toLowerCase();
  const content = (day.content || "").toLowerCase();
  const type    = (day.transportType || "").toLowerCase();
  const isGettingThere = title.includes("getting there") || title.includes("day 0");
  const isGettingHome  = title.includes("getting home")  || title.includes("departure");

  // Transport links for travel days
  if (isGettingThere || isGettingHome) {
    const from = isGettingThere ? origin      : destination;
    const to   = isGettingThere ? destination : origin;
    const date = isGettingThere ? dateFrom    : dateTo;

    if (type === "flight" || (!type && (content.includes("fly") || content.includes("flight") || content.includes("airport")))) {
      const link = flightLink(from, to, date);
      if (link) links.push(link);
    } else if (type === "train" || content.includes("train") || content.includes("rail") || content.includes("eurostar")) {
      const link = trainLink(from, to, date);
      if (link) links.push(link);
      // Also add flight as alternative
      const flight = flightLink(from, to, date);
      if (flight) links.push({ ...flight, label: "Or search flights" });
    } else if (type === "bus" || content.includes("flixbus") || content.includes("coach")) {
      const link = busLink(from, to);
      if (link) links.push(link);
    } else if (type === "ferry" || content.includes("ferry")) {
      const link = ferryLink(from, to);
      if (link) links.push(link);
    } else if (type === "drive" || content.includes("drive") || content.includes("road trip")) {
      const link = driveLink(from, to);
      if (link) links.push(link);
    } else {
      // Unknown — offer flight and train
      const flight = flightLink(from, to, date);
      const train  = trainLink(from, to, date);
      if (flight) links.push(flight);
      if (train)  links.push(train);
    }

    // Accommodation link for arrival day
    if (isGettingThere) {
      const hostel = hostelLink(destination, dateFrom, dateTo);
      if (hostel) links.push(hostel);
    }
  }

  // For regular days that mention specific transport (internal travel)
  if (!isGettingThere && !isGettingHome) {
    if (content.includes("ferry")) {
      const loc = day.locationName || destination;
      links.push({ label: "Find local ferries", url: `https://www.directferries.com` });
    }
    if (content.includes("train") && content.includes("book")) {
      const link = trainLink(day.locationName, destination, dateFrom);
      if (link) links.push(link);
    }
  }

  return links;
}
