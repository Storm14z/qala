/* Qala — seed data.
   Entities mirror the ERD from the presentation: Place, Event, Review, Badge, Genre (interests).
   Coordinates are approximate (prototype only). */

const QALA_DATA = (() => {
  const GENRES = ["Music", "Tech", "Sport", "Art", "Business", "Food"];

  // Approximate "you are here" point in central Astana
  const USER_LOC = { lat: 51.1282, lng: 71.4215 };

  // open: [openHour, closeHour] in 24h, dur = typical visit in minutes
  const PLACES = [
    { id: "p1", name: "Baiterek Tower", cat: "Landmark", tags: ["Art"], tagsUI: ["Landmark", "Photo spot"],
      lat: 51.1283, lng: 71.4305, rating: 4.8, reviews: 312, open: [10, 22], dur: 60, price: 2500, indoor: false,
      addr: "Nurzhol Blvd, Astana", emoji: "🗼", grad: ["#1e3a8a", "#3b82f6"],
      desc: "Iconic observation tower with city views. Best at sunset." },
    { id: "p2", name: "Khan Shatyr", cat: "Shopping & Leisure", tags: ["Food", "Sport"], tagsUI: ["Indoor", "Family"],
      lat: 51.1325, lng: 71.4036, rating: 4.7, reviews: 540, open: [10, 22], dur: 120, price: 0, indoor: true,
      addr: "Turan Ave 37, Astana", emoji: "🎪", grad: ["#0f766e", "#2dd4bf"],
      desc: "A giant transparent tent with shops, a beach club and cafés. Warm all year round." },
    { id: "p3", name: "National Museum of Kazakhstan", cat: "Museum", tags: ["Art"], tagsUI: ["Museum", "History"],
      lat: 51.1236, lng: 71.4412, rating: 4.7, reviews: 268, open: [10, 18], dur: 90, price: 1500, indoor: true,
      addr: "Tauelsizdik Ave 54, Astana", emoji: "🏛️", grad: ["#7c2d12", "#fb923c"],
      desc: "The country's largest museum: Golden Man, nomad culture and modern history." },
    { id: "p4", name: "Hazrat Sultan Mosque", cat: "Landmark", tags: ["Art"], tagsUI: ["Landmark", "Architecture"],
      lat: 51.1313, lng: 71.4725, rating: 4.9, reviews: 410, open: [9, 20], dur: 45, price: 0, indoor: true,
      addr: "Tauelsizdik Ave 56, Astana", emoji: "🕌", grad: ["#065f46", "#34d399"],
      desc: "One of the largest mosques in Central Asia. Free entry, modest dress required." },
    { id: "p5", name: "Palace of Peace and Reconciliation", cat: "Landmark", tags: ["Art", "Business"], tagsUI: ["Architecture", "Culture"],
      lat: 51.1226, lng: 71.4636, rating: 4.6, reviews: 190, open: [10, 18], dur: 60, price: 1000, indoor: true,
      addr: "Tauelsizdik Ave 57, Astana", emoji: "🔺", grad: ["#4c1d95", "#a78bfa"],
      desc: "Norman Foster's glass pyramid with an opera hall and a winter garden." },
    { id: "p6", name: "Astana Opera", cat: "Theatre", tags: ["Music", "Art"], tagsUI: ["Opera", "Ballet"],
      lat: 51.1250, lng: 71.4090, rating: 4.9, reviews: 355, open: [10, 21], dur: 120, price: 4000, indoor: true,
      addr: "Kabanbay Batyr Ave 1, Astana", emoji: "🎭", grad: ["#831843", "#f472b6"],
      desc: "Marble-and-gold opera house with a top international ballet and opera programme." },
    { id: "p7", name: "Nur Alem (EXPO Sphere)", cat: "Museum", tags: ["Tech", "Business"], tagsUI: ["Energy", "Futuristic"],
      lat: 51.0896, lng: 71.4165, rating: 4.6, reviews: 421, open: [10, 20], dur: 90, price: 2000, indoor: true,
      addr: "EXPO Park, Astana", emoji: "🔮", grad: ["#1e40af", "#60a5fa"],
      desc: "The largest spherical building in the world, with 8 floors about the energy of the future." },
    { id: "p8", name: "Astana Hub", cat: "Tech Park", tags: ["Tech", "Business"], tagsUI: ["Startups", "Coworking"],
      lat: 51.0885, lng: 71.4180, rating: 4.5, reviews: 98, open: [9, 20], dur: 90, price: 0, indoor: true,
      addr: "EXPO Business Center, Astana", emoji: "💡", grad: ["#0c4a6e", "#38bdf8"],
      desc: "The international technopark for IT startups: events, demo days and workshops." },
    { id: "p9", name: "Duman Oceanarium", cat: "Family", tags: ["Sport", "Food"], tagsUI: ["Family", "Indoor"],
      lat: 51.1478, lng: 71.4136, rating: 4.5, reviews: 233, open: [10, 20], dur: 90, price: 3500, indoor: true,
      addr: "Dostyk Ave, Astana", emoji: "🐠", grad: ["#155e75", "#22d3ee"],
      desc: "Sharks, rays and a tunnel aquarium, a great plan for a snowy day." },
    { id: "p10", name: "Presidential Park", cat: "Park", tags: ["Sport"], tagsUI: ["Walk", "Nature"],
      lat: 51.1330, lng: 71.4372, rating: 4.6, reviews: 175, open: [0, 24], dur: 60, price: 0, indoor: false,
      addr: "Left bank, Astana", emoji: "🌳", grad: ["#14532d", "#4ade80"],
      desc: "Central park with fountains and a 3 km walking loop beside the Ishim River." },
    { id: "p11", name: "Ishim River Embankment", cat: "Park", tags: ["Sport", "Food"], tagsUI: ["Walk", "Photo spot"],
      lat: 51.1290, lng: 71.4180, rating: 4.7, reviews: 204, open: [0, 24], dur: 45, price: 0, indoor: false,
      addr: "Ishim River, Astana", emoji: "🌉", grad: ["#1e3a5f", "#7dd3fc"],
      desc: "Evening promenade with cafés and views of the skyline." },
    { id: "p12", name: "Central Concert Hall", cat: "Concert Hall", tags: ["Music"], tagsUI: ["Concerts", "Indoor"],
      lat: 51.1238, lng: 71.4262, rating: 4.7, reviews: 142, open: [10, 23], dur: 120, price: 3000, indoor: true,
      addr: "Qabanbay Batyr Ave, Astana", emoji: "🎻", grad: ["#7f1d1d", "#f87171"],
      desc: "Largest concert venue in the capital: symphonic, pop and jazz nights." },
    { id: "p13", name: "Green Bazaar Food Hall", cat: "Food market", tags: ["Food"], tagsUI: ["Local food", "Budget"],
      lat: 51.1475, lng: 71.4630, rating: 4.4, reviews: 120, open: [9, 21], dur: 60, price: 3000, indoor: true,
      addr: "Right bank, Astana", emoji: "🍢", grad: ["#9a3412", "#fdba74"],
      desc: "Lively market hall: beshbarmak, samsa, kumys and Central Asian street food." },
    { id: "p14", name: "Alem Sport Arena", cat: "Sport", tags: ["Sport"], tagsUI: ["Sport", "Indoor"],
      lat: 51.1105, lng: 71.4020, rating: 4.4, reviews: 76, open: [8, 22], dur: 90, price: 2000, indoor: true,
      addr: "Left bank, Astana", emoji: "🏟️", grad: ["#334155", "#94a3b8"],
      desc: "Indoor arena for hockey, basketball and open training sessions." }
  ];

  // day = offset from today (0 = today). start in "HH:MM", dur in minutes, price in KZT
  const EVENTS = [
    { id: "e1", title: "Startup Workshop", place: "p8", day: 0, start: "10:00", dur: 120, cat: "Tech", price: 0,
      desc: "Hands-on workshop: validate an idea, build an MVP plan and pitch it in 3 minutes.", organizer: "Astana Hub" },
    { id: "e2", title: "Street Food Fest", place: "p7", day: 0, start: "14:00", dur: 180, cat: "Food", price: 0,
      desc: "20 food trucks, live cooking and tastings from Kazakh and world cuisines.", organizer: "EXPO Park" },
    { id: "e3", title: "Jazz Night", place: "p12", day: 0, start: "19:00", dur: 120, cat: "Music", price: 3000,
      desc: "Live quartet with guest saxophone. Cosy seating and a bar.", organizer: "Concert Hall" },
    { id: "e4", title: "Contemporary Art Walk", place: "p3", day: 1, start: "12:00", dur: 90, cat: "Art", price: 1500,
      desc: "Guided tour through the new exhibition of Central Asian artists.", organizer: "National Museum" },
    { id: "e5", title: "AI & Future Meetup", place: "p8", day: 1, start: "18:00", dur: 120, cat: "Tech", price: 0,
      desc: "Lightning talks on practical AI from local developers. Networking after.", organizer: "Astana Hub" },
    { id: "e6", title: "Ballet: Swan Lake", place: "p6", day: 1, start: "19:00", dur: 150, cat: "Art", price: 8000,
      desc: "Classic ballet performed by the Astana Opera company.", organizer: "Astana Opera" },
    { id: "e7", title: "Morning 5K Run", place: "p10", day: 2, start: "09:00", dur: 60, cat: "Sport", price: 0,
      desc: "Friendly community run along the Ishim river. All paces welcome.", organizer: "Astana Runners" },
    { id: "e8", title: "Business Breakfast", place: "p5", day: 2, start: "10:00", dur: 90, cat: "Business", price: 5000,
      desc: "Networking breakfast with founders and investors.", organizer: "Astana Business Club" },
    { id: "e9", title: "Indie Rock Live", place: "p12", day: 2, start: "20:00", dur: 150, cat: "Music", price: 4500,
      desc: "Three local indie bands on one stage.", organizer: "Concert Hall" },
    { id: "e10", title: "Hockey: Barys vs. Sibir", place: "p14", day: 3, start: "19:30", dur: 150, cat: "Sport", price: 3500,
      desc: "KHL match night. Bring a scarf, the arena is loud.", organizer: "Barys" },
    { id: "e11", title: "Kazakh Cuisine Masterclass", place: "p13", day: 3, start: "13:00", dur: 120, cat: "Food", price: 6000,
      desc: "Cook beshbarmak and baursak with a local chef, then eat what you made.", organizer: "Green Bazaar" },
    { id: "e12", title: "Hackathon Demo Day", place: "p8", day: 4, start: "15:00", dur: 180, cat: "Tech", price: 0,
      desc: "Final presentations of 12 student teams. Open to everybody.", organizer: "Astana Hub" },
    { id: "e13", title: "Symphony Evening", place: "p6", day: 4, start: "19:00", dur: 120, cat: "Music", price: 6000,
      desc: "Beethoven and Kazakh composers with the State Symphony Orchestra.", organizer: "Astana Opera" },
    { id: "e14", title: "Photo Walk: Winter Astana", place: "p11", day: 5, start: "11:00", dur: 120, cat: "Art", price: 0,
      desc: "A group photo walk with tips from a professional photographer.", organizer: "Qala Community" },
    { id: "e15", title: "Open Training: Basketball", place: "p14", day: 5, start: "17:00", dur: 90, cat: "Sport", price: 1000,
      desc: "Join a mixed-level game. Balls and bibs provided.", organizer: "Alem Sport" },
    { id: "e16", title: "Startup Pitch Night", place: "p7", day: 6, start: "18:30", dur: 150, cat: "Business", price: 2000,
      desc: "Ten founders pitch to a live panel of investors.", organizer: "EXPO Park" }
  ];

  const REVIEWS = {
    p1: [{ who: "Aigerim", rating: 5, text: "Amazing view at sunset!" }, { who: "Marat", rating: 5, text: "Go in the evening, the city lights are great." }],
    p2: [{ who: "Dana", rating: 5, text: "Warm in winter and plenty to do." }],
    p3: [{ who: "Timur", rating: 5, text: "The Golden Man hall is worth the whole trip." }],
    p4: [{ who: "Aisha", rating: 5, text: "Peaceful and beautiful inside." }],
    p6: [{ who: "Nurlan", rating: 5, text: "Best ballet I have seen in Central Asia." }],
    p7: [{ who: "Alex", rating: 4, text: "Futuristic. Allow at least 2 hours." }],
    p8: [{ who: "Dias", rating: 5, text: "Great events for students and founders." }],
    p13: [{ who: "Madina", rating: 4, text: "Try the samsa. Cash helps." }]
  };

  // Badge rules are evaluated in app.js
  const BADGES = [
    { id: "explorer", name: "Explorer", icon: "🧭", hint: "Save 3 places to My Day" },
    { id: "nightowl", name: "Night Owl", icon: "🦉", hint: "Check in at an evening event (after 18:00)" },
    { id: "foodie", name: "Foodie", icon: "🍜", hint: "Save or check in at a Food place or event" },
    { id: "planner", name: "Planner", icon: "🧠", hint: "Accept an AI-generated plan" },
    { id: "social", name: "Social", icon: "🤝", hint: "Add a friend" },
    { id: "critic", name: "Critic", icon: "✍️", hint: "Write a review" }
  ];

  const FRIENDS = ["Daulet", "Aliakhmet"];

  return { GENRES, USER_LOC, PLACES, EVENTS, REVIEWS, BADGES, FRIENDS };
})();

if (typeof module !== "undefined") module.exports = QALA_DATA;
