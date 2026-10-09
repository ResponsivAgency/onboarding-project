// Team Maria training content.
//
// To add a video, paste its YouTube or Vimeo link into videoUrl (unlisted YouTube works).
// Mindset videos can link anywhere (Instagram, Facebook, YouTube); they open in a new tab.
// Lesson order matters: people unlock lessons in the order they appear here.
// Adding lessons to the end is safe. Reordering or removing lessons after people have
// started will shift their saved progress, so check with the team before doing that.

const ONBOARDING = [
  {
    videoUrl: "",
    title: "Welcome to Team Maria",
    mins: 6,
    summary: "Maria shares how she started, why she built this team, and what our culture is all about: showing up, lifting each other, and celebrating every win.",
    points: ["Maria’s story and why she built Team Maria", "Our team values and how we support each other", "How this onboarding path works"],
    action: "Introduce yourself in the Team Maria group chat and share one sentence about why you joined."
  },
  {
    videoUrl: "",
    title: "Setting Up Your Back Office",
    mins: 8,
    summary: "A screen-by-screen walkthrough of your distributor back office so you know where to find your orders, your team, your commissions, and your personal website link.",
    points: ["Logging in and completing your profile", "Finding your personal shopping link", "Where to see orders, volume, and commissions"],
    action: "Log in, finish your profile, and copy your personal website link somewhere handy."
  },
  {
    videoUrl: "",
    title: "Know Your Products",
    mins: 12,
    summary: "Our best-selling products, who they’re for, and how to talk about them in your own words. You don’t need to be an expert. You just need to share what you love.",
    points: ["The five hero products to know first", "Simple ways to describe each one", "Compliance: what we can and can’t say"],
    action: "Pick your personal favorite product and write two sentences about why you love it."
  },
  {
    videoUrl: "",
    title: "Your Why & 90-Day Goals",
    mins: 7,
    summary: "Everything in this business gets easier when you’re clear on why you’re here. We’ll help you name your why and set a realistic 90-day goal.",
    points: ["Finding a why that actually moves you", "Setting a 90-day rank or income goal", "Choosing how many hours a week you’ll commit"],
    action: "Write down your why and your 90-day goal, then send them to Maria."
  },
  {
    videoUrl: "",
    title: "Building Your Contact List",
    mins: 10,
    summary: "Your first 100 names are already in your phone. We’ll walk through a memory jogger so you can build a list without pressure or awkwardness.",
    points: ["Using the memory jogger", "Warm market vs. social media contacts", "Why you never pre-judge who might be interested"],
    action: "Write down at least 50 names. Aim for 100 by the end of the week."
  },
  {
    videoUrl: "",
    title: "Sharing the Opportunity",
    mins: 14,
    summary: "How to start your first conversations naturally, invite people to look at products or the business, and hand off to your upline for a three-way chat.",
    points: ["Simple invitation scripts that feel like you", "How three-way messages with your upline work", "Handling “I’m not interested” with grace"],
    action: "Send your first 5 invitations and tell Maria how they went."
  },
  {
    videoUrl: "",
    title: "Your First 30 Days",
    mins: 9,
    summary: "Your daily method of operation: the small, repeatable actions that build momentum. Follow this for 30 days and you’ll be on your way to your first rank advancement.",
    points: ["The daily 5: posts, conversations, and follow-ups", "Weekly team calls and trainings to attend", "How to track your activity and celebrate wins"],
    action: "Book your launch call with Maria and put the weekly team call on your calendar."
  }
]

// Premium only. Placeholder lessons until Maria sends the real content.
const ADVANCED = [
  {
    videoUrl: "",
    title: "Leading Your First Team Member",
    mins: 10,
    summary: "When someone joins under you, the first two weeks set the tone. Here’s how to welcome them, walk them through onboarding, and be the sponsor you wish you’d had.",
    points: ["Your welcome-call checklist", "Checking in without hovering", "When to loop in Maria or your team leader"],
    action: "Write your own welcome-call checklist and send it to Maria for feedback."
  },
  {
    videoUrl: "",
    title: "Hosting Product Parties & Virtual Events",
    mins: 13,
    summary: "In-home and online events are the fastest way to reach new people. We’ll cover planning, invites, running the event, and the follow-up that turns guests into customers.",
    points: ["Choosing in-person, Zoom, or a Facebook pop-up", "A simple 45-minute event flow", "Following up within 48 hours"],
    action: "Pick a date for your first event and ask someone to host it."
  },
  {
    videoUrl: "",
    title: "Social Media That Attracts",
    mins: 11,
    summary: "Posting more isn’t the goal. We’ll look at the kinds of posts that start conversations, how often to show up, and how to share products without sounding like an ad.",
    points: ["The 80/20 split between personal and business posts", "Stories that start DMs", "Staying compliant online"],
    action: "Plan your next 7 days of posts and share the plan with your sponsor."
  },
  {
    videoUrl: "",
    title: "Duplication: Teaching the System",
    mins: 9,
    summary: "Your business grows when your team can do what you do. Learn how to hand new people this same onboarding path and coach them through it.",
    points: ["Why simple beats impressive", "Getting new people started on onboarding", "Running a three-way chat for someone on your team"],
    action: "Walk through Lesson 1 of onboarding with a newer team member."
  },
  {
    videoUrl: "",
    title: "Running Your Business by the Numbers",
    mins: 12,
    summary: "Understand the numbers in your back office, like volume, active customers, and rank requirements, so you always know what to do next.",
    points: ["Reading your volume report", "Tracking customers vs. distributors", "Setting a monthly activity target"],
    action: "Find your current volume and write down what you need for your next rank."
  },
  {
    videoUrl: "",
    title: "Your Path to Leadership Rank",
    mins: 14,
    summary: "What it takes to reach team leader, what changes when you get there, and how Maria and the leadership team will support you along the way.",
    points: ["Leadership rank requirements", "Building a small leadership circle", "Your 6-month leadership plan"],
    action: "Book a leadership planning call with Maria."
  }
]

// Placeholder mindset videos. Put each real link in url.
const MINDSET = [
  { title: "Stop waiting to feel ready", from: "Maria", platform: "Instagram", length: "1:12", url: "" },
  { title: "Rejection isn’t a verdict", from: "Maria", platform: "Facebook", length: "3:40", url: "" },
  { title: "Your why on the hard days", from: "Cassandra Wells", platform: "Instagram", length: "0:58", url: "" },
  { title: "Comparison steals your momentum", from: "Maria", platform: "Instagram", length: "1:30", url: "" },
  { title: "Consistency beats motivation", from: "Maria", platform: "Facebook", length: "4:05", url: "" },
  { title: "Talking to people without feeling salesy", from: "Jasmine Lee", platform: "Instagram", length: "2:15", url: "" },
  { title: "Getting comfortable on camera", from: "Maria", platform: "Facebook", length: "5:20", url: "" },
  { title: "Celebrate the small wins", from: "Cassandra Wells", platform: "Instagram", length: "0:45", url: "" }
]

module.exports = { ONBOARDING, ADVANCED, MINDSET };
