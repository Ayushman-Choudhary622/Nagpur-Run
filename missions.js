// =============================================================
// REAL NAGPUR STREET VIEW LOCATIONS, NPCS & MISSIONS
// Every coordinate is placed on a major Nagpur arterial road
// with real Street View coverage [lat, lng]
// =============================================================

// Optional: Paste your keys here if you want to deploy pre-configured
const DEFAULT_GOOGLE_MAPS_KEY = "";
const DEFAULT_MAPILLARY_TOKEN = "";

const NAGPUR_SPOTS = [
  { name: "Zero Mile Sq", lat: 21.1498, lng: 79.0806, heading: 180 },
  { name: "Variety Sq (Sitabuldi)", lat: 21.1431, lng: 79.0802, heading: 265 },
  { name: "Shankar Nagar Sq", lat: 21.1362, lng: 79.0616, heading: 300 },
  { name: "Futala Lake Rd", lat: 21.1536, lng: 79.0448, heading: 95 },
  { name: "Sadar Residency Rd", lat: 21.1592, lng: 79.0788, heading: 175 },
  { name: "Civil Lines (High Ct)", lat: 21.1525, lng: 79.0695, heading: 110 },
  { name: "Deekshabhoomi Sq", lat: 21.1282, lng: 79.0672, heading: 15 },
  { name: "VNIT / Ambazari T-Pt", lat: 21.1258, lng: 79.0518, heading: 45 },
  { name: "Ajni Sq (Wardha Rd)", lat: 21.1195, lng: 79.0725, heading: 195 },
  { name: "Nagpur Airport Sq", lat: 21.0938, lng: 79.0608, heading: 15 }
];

const NPCS = [
  {
    id: "bunty",
    name: "Bunty Bhai",
    avatar: "🕶️",
    place: "Zero Mile Square",
    lat: 21.1498,
    lng: 79.0806,
    greeting: "Kya bolta Nagpur! Real streets, real traffic, real Orange City. Ready for a run?",
    missions: ["m1", "m5"]
  },
  {
    id: "riya",
    name: "Riya",
    avatar: "🎒",
    place: "Shankar Nagar Square, Dharampeth",
    lat: 21.1362,
    lng: 79.0616,
    greeting: "Look around—actual Dharampeth! Got a quick parcel run up to Futala if you're free.",
    missions: ["m2"]
  },
  {
    id: "kabir",
    name: "Kabir",
    avatar: "🎧",
    place: "Futala Lake Chaupati",
    lat: 21.1536,
    lng: 79.0448,
    greeting: "Futala Lake view never gets old! Take my city circuit challenge for big cash.",
    missions: ["m3", "m6"]
  },
  {
    id: "farhan",
    name: "Farhan Mechanic",
    avatar: "🔧",
    place: "Sadar Liberty Chowk",
    lat: 21.1592,
    lng: 79.0788,
    greeting: "Need spare parts dropped in Civil Lines and Sitabuldi before closing time!",
    missions: ["m4"]
  }
];

const MISSIONS = {
  m1: {
    id: "m1",
    title: "Tarri Poha Express",
    reward: 600,
    timeLimit: 0,
    offerText: "Drive down Sitabuldi Main Rd to Variety Square, grab the parcel, and deliver it to Riya at Shankar Nagar Square.",
    steps: [
      {
        label: "Drive to Variety Square, Sitabuldi",
        lat: 21.1431,
        lng: 79.0802,
        doneText: "Hot parcel collected! Head west toward Shankar Nagar Square."
      },
      {
        label: "Deliver to Riya at Shankar Nagar Sq",
        lat: 21.1362,
        lng: 79.0616,
        doneText: "Delivered piping hot! Earned ₹600."
      }
    ]
  },
  m2: {
    id: "m2",
    title: "Futala Lake Cruise",
    reward: 900,
    timeLimit: 0,
    offerText: "Take Kabir's camera bag up Amravati Road to Futala Lake Chaupati.",
    steps: [
      {
        label: "Drive to Futala Lake Chaupati",
        lat: 21.1536,
        lng: 79.0448,
        doneText: "Bag delivered at Futala! Earned ₹900."
      }
    ]
  },
  m3: {
    id: "m3",
    title: "Ambazari to Deekshabhoomi",
    reward: 1200,
    timeLimit: 0,
    offerText: "Cruise past VNIT / Ambazari T-Point and finish at Deekshabhoomi Square.",
    steps: [
      {
        label: "Reach VNIT / Ambazari T-Point",
        lat: 21.1258,
        lng: 79.0518,
        doneText: "Checkpoint cleared! Continue east to Deekshabhoomi Square."
      },
      {
        label: "Finish at Deekshabhoomi Square",
        lat: 21.1282,
        lng: 79.0672,
        doneText: "Smooth real-street run! Earned ₹1,200."
      }
    ]
  },
  m4: {
    id: "m4",
    title: "Sadar to Civil Lines Drop",
    reward: 1100,
    timeLimit: 0,
    offerText: "Deliver custom engine parts from Sadar to Civil Lines High Court Square and back to Zero Mile.",
    steps: [
      {
        label: "Drop parts at Civil Lines High Court Sq",
        lat: 21.1525,
        lng: 79.0695,
        doneText: "Parts delivered! Head east back to Zero Mile Square."
      },
      {
        label: "Meet Bunty Bhai at Zero Mile Sq",
        lat: 21.1498,
        lng: 79.0806,
        doneText: "Job complete! Earned ₹1,100."
      }
    ]
  },
  m5: {
    id: "m5",
    title: "Wardha Road Airport VIP",
    reward: 1800,
    timeLimit: 0,
    offerText: "Drive south down Wardha Road past Ajni Square all the way to Nagpur Airport Square.",
    steps: [
      {
        label: "Pass Ajni Square on Wardha Road",
        lat: 21.1195,
        lng: 79.0725,
        doneText: "Halfway there! Continue straight down Wardha Road to Airport Sq."
      },
      {
        label: "Arrive at Nagpur Airport Square",
        lat: 21.0938,
        lng: 79.0608,
        doneText: "VIP dropped right at Airport Gate! Earned ₹1,800."
      }
    ]
  },
  m6: {
    id: "m6",
    title: "Orange City Street Tour",
    reward: 3000,
    timeLimit: 0,
    offerText: "Full Nagpur Street View tour: Civil Lines → Sadar → Zero Mile → Shankar Nagar → Futala!",
    steps: [
      { label: "CP 1/4: Civil Lines High Court Sq", lat: 21.1525, lng: 79.0695, doneText: "1/4 Clear! Head to Sadar!" },
      { label: "CP 2/4: Sadar Residency Rd", lat: 21.1592, lng: 79.0788, doneText: "2/4 Clear! Drop south to Zero Mile!" },
      { label: "CP 3/4: Zero Mile Square", lat: 21.1498, lng: 79.0806, doneText: "3/4 Clear! Head west to Shankar Nagar Sq!" },
      { label: "FINISH: Shankar Nagar Square", lat: 21.1362, lng: 79.0616, doneText: "NAGPUR STREET CHAMPION! +₹3,000!" }
    ]
  }
};
