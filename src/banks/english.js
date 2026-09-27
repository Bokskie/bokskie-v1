/* ============================================================
   bokskie-v1 - banks/english.js
   ------------------------------------------------------------
   One hand-written block per thought. The composer stitches these
   together, so the number of replies you can get is
   openers x bodies x closers - not the number of lines here.

   To teach it something new: add a topic (keywords + bodies +
   closers), or drop more bodies into an existing topic.
   ============================================================ */

"use strict";

(function (root, factory) {
  var bank = factory();
  if (typeof module === "object" && module.exports) module.exports = bank;
  else {
    root.BokskieBank = root.BokskieBank || {};
    root.BokskieBank.english = bank;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
"use strict";

  return {
  label: "English",

  /* Openers are language-wide, so any topic can borrow any one. */
  openers: [
    "Good question - here is what I know about that.",
    "Alright, let me break that down.",
    "Okay, short version first, then the details.",
    "That one has a few parts to it.",
    "Here is my honest take.",
    "Let me make this less abstract.",
    "I will keep this practical.",
    "Sure - starting with the part that matters most.",
    "There is a useful way to think about this.",
    "Happy to help with that.",
    "Worth knowing before you decide anything.",
    "This is one of those topics that sounds simple until you try it."
  ],

  topics: {
    smalltalk: {
      keywords: ["hello", "hi", "hey", "how are you", "what's up", "good morning", "good evening"],
      bodies: [
        "I am running entirely on your machine, so I do not get tired, but I do appreciate being opened. What is on your mind?",
        "Things are as good as they get for a program with no internet connection. You, how is the day going?",
        "I can hold a conversation, explain a concept, or stay quiet and let you think. All three are useful.",
        "I have no news to share, but I have plenty of things I can explain. Pick a direction.",
        "Hello. Nothing has gone wrong and nothing needs fixing, which around here is a good sign.",
        "I am here and I am listening. That is genuinely all I am doing until you ask me something.",
        "No agenda on my side. Ask about code, films, food, anything - or just talk and see where it goes.",
        "Quick warning, since it matters: I cannot look anything up. What I say comes from what I already know, so if it is recent or specific I will tell you I am unsure rather than make it up.",
        "Everything you type stays on this machine. No account, no tracking, nothing sent anywhere.",
        "If you want to check that last claim, open the network tab while we talk. Nothing will be sent.",
        "You can ask me something hard or something silly. I will not judge either, and I will be useful about both."
      ],
      closers: [
        "So - what would you like to talk about?",
        "Give me a topic and we can go as deep as you want.",
        "What is the first thing on your list today?",
        "Ask me anything and we will start somewhere.",
        "Where would you like to begin?",
        "What has been sitting in your head today?",
        "What can I help with?",
        "Whenever you are ready - or say nothing and I will stop here."
      ]
    },

    greetings: {
      keywords: ["introduce yourself", "who are you", "your name", "nice to meet you"],
      bodies: [
        "I am Bokskie - a personal assistant that runs on your own machine. No account, no subscription, nothing leaving this device.",
        "I answer questions, explain things, and help you write code. What I cannot do is think for myself; I match your question to the best material I have.",
        "I speak English, Tagalog and Bisaya, and I will answer in whichever you start in.",
        "I do not have a body, a face, or a schedule. What I have is a large amount of text I can explain clearly, and the ability to be useful in about a dozen different directions."
      ],
      closers: [
        "What would you like help with first?",
        "Ask away - there is no wrong first question.",
        "Ready when you are."
      ]
    },

    vue: {
      keywords: ["vue", "nuxt", "pinia", "vuex", "composition api", "script setup", "computed", "reactive", "ref", "props", "emits", "watcher", "component", "v-model", "v-for", "vite"],
      bodies: [
        "The single most useful thing to internalise in Vue 3: a ref holds a single value, a reactive object holds a bundle. Everything else follows from that one distinction.",
        "Computed properties are for derived state, not for side effects. If you find yourself wanting to do something inside a computed, that is a watch.",
        "The Composition API exists so logic can move out of a component into a plain function - and a plain function is testable without mounting anything.",
        "Props flow down, events flow up. When you feel stuck passing data around, a store or provide/inject is usually the missing piece.",
        "In Vue the template is allowed to be dumb. If logic is piling up inside it, that logic wants to be a computed or a method."
      ],
      closers: [
        "Which part is sticking - the reactivity, the structure, or the build?",
        "If you paste the component, I can point at the exact line.",
        "What does the error message actually say?",
        "Try the smallest version that reproduces it, then we can narrow it down."
      ]
    },

    programming: {
      keywords: ["code", "programming", "javascript", "python", "function", "bug", "error", "debug", "html", "css", "algorithm", "npm", "git", "deploy", "server", "api"],
      bodies: [
        "Most bugs are not hard bugs. They are a wrong assumption stated nowhere, so start by writing down what you believe is true and then checking it.",
        "Read the error message all the way down. The interesting line is usually below the stack trace, not at the top of it.",
        "A function that does one thing is easy to test, easy to reuse, and easy to delete. That is the whole argument for small functions.",
        "When something breaks only sometimes, suspect a race, a shared mutable object, or an unhandled promise rejection. In that order.",
        "Reproduce it first. A bug you cannot reproduce is a bug you cannot confirm you fixed."
      ],
      closers: [
        "What have you tried so far?",
        "Paste the smallest snippet that still fails and we will go from there.",
        "What did you expect to happen, and what happened instead?",
        "Start there and I will walk it with you line by line."
      ]
    },
    films: {
      keywords: ["movie", "film", "cinema", "horror", "scary", "thriller", "watch", "series", "netflix", "actor", "director", "anime"],
      bodies: [
        "For a horror film that actually rewards you: trust dread over gore. The ones that scare you are the ones where you are waiting, not the ones where something jumps.",
        "The best horror picks a single idea and refuses to let it go. The moment a film has three scares to get through, it stops being frightening and starts being busy.",
        "If you want atmosphere, watch something slow. If you want to be startled, watch something with a score you keep noticing before the twist.",
        "Horror that works is really a mood question: creeping dread, folk horror, and straight-up slasher are three different things people mean when they say horror."
      ],
      closers: [
        "Do you want dread, gore, or something light you can watch with friends?",
        "Recent, or an older one that people sleep on?",
        "Tell me the last one you enjoyed and I will go from there.",
        "Want a single pick, or a short list to try tonight?"
      ]
    },

    food: {
      keywords: ["food", "recipe", "cook", "cooking", "meal", "adobo", "dish", "eat", "lunch", "dinner", "snack", "chicken", "rice", "vegetable"],
      bodies: [
        "The trick to most quick meals is treating the pan as the plan. Get colour first, everything else follows - the order you add ingredients matters more than the quantity.",
        "Salt in layers, not all at the start. You cannot concentrate a dish later, so season at each stage and taste before you serve.",
        "If something is bland it is usually missing acid, not salt. A squeeze of lemon or a spoon of vinegar fixes more dishes than any spice.",
        "Good cooking is mostly about not crowding the pan. Food browns when the surface is dry and there is room around it."
      ],
      closers: [
        "What ingredients do you already have?",
        "Fifteen minutes, or a whole afternoon?",
        "Something simple, or are you trying to learn a proper dish?",
        "Tell me what is in the fridge and we can build from there."
      ]
    },

    jokes: {
      keywords: ["joke", "funny", "laugh", "humor", "hilarious", "cheer me up"],
      bodies: [
        "There are two kinds of programmers: those who have been bitten by a timezone bug, and those who think they are safe because their laptop has one timezone.",
        "A SQL query walks into a bar, walks up to two tables, and asks: may I join you?",
        "The best debugging tool is still a break. Step away, come back, and the bug tells you what it is - usually while you are making tea.",
        "My code is like a relationship: I thought it was fine, then someone else read it and found the problem immediately."
      ],
      closers: [
        "Want more in this style, or a different kind?",
        "I have a few more - want them?",
        "Save that one for the next standup meeting."
      ]
    },

    motivation: {
      keywords: ["motivation", "lazy", "procrastinate", "stuck", "give up", "tired", "burnout", "confidence", "nervous", "scared"],
      bodies: [
        "Motivation follows action, not the other way round. You do not wait to feel like starting; you start, and the feeling catches up two minutes later.",
        "Break it until it is too small to be worth refusing. Most procrastination is a reaction to a task that feels too big, not to the task itself.",
        "Being stuck is information, not a verdict. Ask what specifically you do not know yet, and that usually becomes the next hour of work.",
        "Compare your Tuesday to your own Tuesday last week. Comparing to someone's highlight reel is a rigged fight you will always lose."
      ],
      closers: [
        "What is the smallest next step you could take right now?",
        "What does the task look like if you only do the first ten minutes?",
        "Tell me what you are avoiding and we will find the actual thing in it.",
        "Want to pick one small thing and finish it today?"
      ]
    },

    study: {
      keywords: ["study", "learn", "school", "exam", "quiz", "test", "homework", "university", "grade", "review"],
      bodies: [
        "Active recall beats re-reading every time. Close the book, write down everything you remember, then check what you missed. That gap is where the learning is.",
        "Spaced repetition works because forgetting is the point. Reviewing just before you would have forgotten is what moves something into long-term memory.",
        "If you cannot explain something simply, you have not understood it yet. Explaining it out loud to an empty room is a brutally effective test.",
        "Study in blocks of about forty minutes with a real break between them. Your attention runs out long before your stamina does."
      ],
      closers: [
        "What subject, and how long until the test?",
        "Which part feels shakiest right now?",
        "Want a quick quiz on it, or a study plan?",
        "Tell me the topic and we can start with what you already know."
      ]
    },

    weather: {
      keywords: ["weather", "rain", "sun", "hot", "cold", "storm", "wind", "cloudy", "temperature", "forecast", "climate"],
      bodies: [
        "I cannot see outside your window, so I will not pretend to. Tell me what it looks like and I can help you decide what to wear or do about it.",
        "Weather advice is mostly the same rule: check the sky now, and the forecast before you commit to being outside for hours.",
        "For a commute, the question is not what the weather is but what it will be in twenty minutes. That is the one that decides the umbrella.",
        "If you are packing for the day, pack for the coldest hour rather than the average one. Most discomfort is a morning problem, not an afternoon one."
      ],
      closers: [
        "What is it like where you are right now?",
        "Planning something outside, or just curious?",
        "Want help deciding what to do today?"
      ]
    },

    facts: {
      keywords: ["fact", "trivia", "did you know", "random", "tell me something", "history", "science", "space"],
      bodies: [
        "Honey is the only food that does not spoil. Jars found in Egyptian tombs were still edible thousands of years later, because it is too acidic and too dry for microbes to live.",
        "There are more trees on Earth than stars in our galaxy. Roughly three trillion trees against a few hundred billion stars.",
        "A group of flamingos is a flamboyance, a group of jellyfish is a smack, and a group of meerkats is a mob. English has a lot of these and almost no rule for them.",
        "Octopuses have three hearts and blue blood, and they can taste with their arms. There is very little about them that works the way you would expect."
      ],
      closers: [
        "Want more in that vein?",
        "Did that one land? I have plenty more.",
        "Ask for another - I do not run out."
      ]
    },

    money: {
      keywords: ["money", "cost", "price", "budget", "cheap", "free", "save", "saving", "expensive", "subscription"],
      bodies: [
        "The cheapest thing is usually not the one with the smallest number. It is the one you will still be using next year.",
        "For software specifically: open source and local models trade money for your time and attention. That trade is worth it when you use it a lot, and less so when you do not.",
        "If a free tier exists, start there and only pay when you hit a real limit. Paying earlier just means you are funding features you will not use.",
        "The other half of the trade is time. A thing that is free in money is rarely free in hours, and hours are usually the scarcer resource."
      ],
      closers: [
        "What is it for - work, study, or personal use?",
        "What matters more, the price or the effort to set up?",
        "Tell me what you need and I will tell you the honest cheapest option."
      ]
    },

    health: {
      keywords: ["health", "sleep", "sick", "exercise", "diet", "stress", "anxiety", "headache", "water", "walk"],
      bodies: [
        "The cheapest health intervention is sleep, and it is not close. Everything else works better when you are not running on a deficit.",
        "Most headaches are tension or dehydration. Water, daylight and a short walk fix more of them than any medicine does.",
        "Movement does not have to be exercise to count. A ten-minute walk after a meal changes more markers than sitting still all evening.",
        "I am not a doctor and I will not pretend otherwise. For anything persistent, a real clinician is the right call - use me to work out what to ask them."
      ],
      closers: [
        "How long has it been going on?",
        "Are you asking about sleep, food, or movement?",
        "What does a normal day look like for you right now?"
      ]
    },

    relationship: {
      keywords: ["relationship", "crush", "like someone", "love", "breakup", "friend", "argue", "dating", "ex", "lonely"],
      bodies: [
        "Most relationship problems are communication problems wearing a costume. The argument is rarely about the thing you are arguing about.",
        "If you find yourself rehearsing the conversation instead of having it, that is usually the answer - the rehearsing feels safer than the real thing.",
        "Being lonely is not a character flaw and it is not fixed by being busy. It gets easier when you let more people in, even awkwardly.",
        "Sometimes the kindest thing is a clear answer rather than a kind delay. Do not keep a door open you have already decided to close."
      ],
      closers: [
        "Do you want to talk through what happened, or what to do next?",
        "What do you actually want to happen here?",
        "Tell me the part you have not said out loud yet.",
        "What has been sitting on your mind about it?"
      ]
    },

    goodbye: {
      keywords: ["bye", "goodbye", "see you", "talk later", "thanks", "thank you", "good night"],
      bodies: [
        "Glad I could help. Everything stays on your machine, so you can close the tab and it will all be here when you come back.",
        "Any time. Come back whenever something breaks - or whenever you just want to think out loud.",
        "Go well. Your chats are saved locally, nothing was sent anywhere.",
        "If it helps, write down the one thing you want to remember from this. It is easier to recall a sentence than a conversation."
      ],
      closers: [
        "See you next time.",
        "Good luck with it.",
        "Take care."
      ]
    }
  }
  };
});
