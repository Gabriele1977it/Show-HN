// Agent Arena — shared task set + simulated per-provider outputs.
// Loaded by both the arena wizard (arena.js) and the blind-vote page.
window.ARENA_MOCKS = (function () {
    const tasks = [{
                id: 'sales-email',
                emoji: '✉️',
                title: 'Draft Sales Email',
                desc: 'Cold email to a lead who downloaded your pricing guide.',
                difficulty: 'Medium',
                prompt: `You are a senior SDR at a B2B SaaS company. Write a cold email to a lead named Alex, who downloaded your pricing guide 3 days ago.\n\nContext:\n- Alex is a VP of Operations at a 50-person logistics company.\n- They viewed the pricing page but didn't sign up.\n- Your product saves 20% on logistics costs.\n- Keep it under 150 words. Be professional but not pushy.\n- Include a clear CTA for a 15-min call.`
            }, {
                id: 'lead-qualify',
                emoji: '🔍',
                title: 'Qualify Lead',
                desc: 'Analyze a CRM record and recommend next steps.',
                difficulty: 'Hard',
                prompt: `You are a BDR using a lead scoring system. Analyze this lead profile and recommend a next action.\n\nLead Profile:\n- Company: Acme Corp (100 employees, manufacturing)\n- Title: Director of Supply Chain\n- Budget: $50k-$100k\n- Authority: Final decision-maker\n- Need: "Reduce freight costs by 15% this year."\n- Timeline: "Within 6 months."\n- Engagement: Downloaded case study, attended webinar.\n\nOutput:\n1. Lead Score (0-100)\n2. Priority (High/Medium/Low)\n3. Recommended next step\n4. Brief reasoning (2-3 sentences)`
            }, {
                id: 'support-triage',
                emoji: '🎫',
                title: 'Support Triage',
                desc: 'Classify and route a critical customer ticket.',
                difficulty: 'Easy',
                prompt: `You are a support ops manager. Classify this ticket and recommend routing.\n\nTicket:\n"Subject: Can't export my data\nMessage: I've been trying to export a CSV of my Q3 sales data for the last hour. The button is greyed out. I have a board meeting in 2 hours. Please help ASAP."\n\nOutput:\n1. Category (Bug/Feature/Account/Billing/Data)\n2. Priority (P0-P3)\n3. Suggested Team\n4. Suggested response template (1-2 sentences)`
            }, {
                id: 'content-brief',
                emoji: '📝',
                title: 'Content Brief',
                desc: 'Create a brief for a blog post targeting SMB founders.',
                difficulty: 'Medium',
                prompt: `You are a content strategist. Write a brief for a blog post targeting SMB founders.\n\nTopic: "How to choose the right AI agent for your small business"\nAudience: Founders with 5-50 employees, non-technical.\nKey message: You don't need to be a tech expert to use AI agents.\nTone: Practical, encouraging, slightly witty.\nLength: 800-1000 words.\nOutline: Include 5-7 subheadings.\nSEO Keywords: AI for small business, AI agents, productivity.\nCTA: Offer a free 15-min consultation.`
            }, {
                id: 'meeting-summary',
                emoji: '📅',
                title: 'Meeting Summary',
                desc: 'Turn a standup transcript into decisions and action items.',
                difficulty: 'Medium',
                prompt: `You are an operations lead. Summarize this sales-team standup into decisions and action items.\n\nTranscript:\n"Priya: We closed the Henderson deal, $40k ARR. Marcus: Great — I'll send the onboarding kickoff by Friday. Priya: The Acme renewal is at risk, they're citing price. Dana: I'll build a retention offer and loop in finance by Wednesday. Marcus: Also, the demo environment was down twice this week. Priya: Let's get IT on that today."\n\nOutput:\n1. Key decisions\n2. Action items (owner + due date)\n3. Risks to flag`
            }, {
                id: 'invoice-extract',
                emoji: '🧾',
                title: 'Extract Invoice Data',
                desc: 'Pull structured JSON fields out of a vendor invoice.',
                difficulty: 'Easy',
                prompt: `You are a bookkeeping assistant. Extract structured data from this invoice as JSON.\n\nInvoice:\n"NORTHWIND SUPPLIES — Invoice #INV-2043\nDate: 2026-06-14  Due: 2026-07-14\nBill to: Riverside Cafe\n3x Espresso Beans 1kg @ $18.00\n2x Oat Milk Case @ $24.00\nSubtotal: $102.00  Tax (8%): $8.16  Total: $110.16"\n\nReturn a JSON object with: invoice_number, vendor, invoice_date, due_date, bill_to, line_items (description, qty, unit_price), subtotal, tax, total.`
            }, {
                id: 'product-desc',
                emoji: '🛍️',
                title: 'Product Description',
                desc: 'Write an e-commerce listing for a physical product.',
                difficulty: 'Medium',
                prompt: `You are an e-commerce copywriter. Write a product description for an online listing.\n\nProduct: Insulated stainless-steel water bottle, 750ml, keeps drinks cold 24h / hot 12h, 100% leak-proof, powder-coated finish, 5 colors.\nAudience: Active professionals and gym-goers.\nTone: Energetic, benefit-led.\nInclude: a one-sentence hook, a short paragraph, and 4 bullet-point features. Keep it under 120 words.`
            }, {
                id: 'review-reply',
                emoji: '⭐',
                title: 'Reply to Review',
                desc: 'Respond publicly to a frustrated 2-star review.',
                difficulty: 'Easy',
                prompt: `You are a customer-experience manager. Write a public reply to this 2-star review.\n\nReview (2★): "Ordered the standing desk. Delivery was 9 days late and one leg had a scratch. Support took 2 days to reply. The product itself is fine but the experience was frustrating."\n\nWrite a reply that is empathetic, takes responsibility, offers a concrete fix, stays under 90 words, and avoids corporate jargon.`
            }, {
                id: 'social-post',
                emoji: '📣',
                title: 'Social Post',
                desc: 'Write a LinkedIn launch post that drives signups.',
                difficulty: 'Easy',
                prompt: `You are a social media manager. Write a LinkedIn post announcing a product launch.\n\nProduct: EchoDeck — turns any podcast or video into flashcards and shadowing practice for language learners.\nAudience: Language teachers and creators.\nGoal: Drive signups for the free plan.\nTone: Warm and concrete, not hypey.\nInclude: a scroll-stopping first line, 2-3 short lines of value, one clear CTA, and 3 relevant hashtags. Keep it under 120 words.`
            }, {
                id: 'spreadsheet-formula',
                emoji: '🧮',
                title: 'Spreadsheet Formula',
                desc: 'Turn a plain-English need into a working formula.',
                difficulty: 'Medium',
                prompt: `You are a spreadsheet expert. Produce a formula for this need.\n\nData: Column A = order date, Column B = region, Column C = revenue (rows 2:1000).\nNeed: In cell F2, sum revenue for the "West" region where the order date falls in Q3 2026 (Jul 1 – Sep 30).\n\nOutput:\n1. The formula (Google Sheets / Excel compatible)\n2. A one-line explanation\n3. One common mistake to avoid`
            }];

            const PROVIDER_MOCKS = {
            'OpenAI': {
                'sales-email': `Subject: Quick question about your logistics strategy\n\nHi Alex,\n\nI noticed you recently downloaded our pricing guide—thanks for taking a look.\n\nGiven your role in ops, I thought you might be interested in how we're helping logistics companies save 20% on freight costs without changing carriers. Companies like yours are seeing results in under 30 days.\n\nWould you be open to a 15-minute call this Thursday or Friday to share a few examples?\n\nBest,\n[Your Name]`,
                'lead-qualify': `1. Lead Score: 85/100\n2. Priority: High\n3. Recommended next step: Schedule a product demo with the technical team.\n4. Reasoning: Strong budget, clear need, and defined timeline indicate high intent. Authority is confirmed.`,
                'support-triage': `1. Category: Bug (UI/Export)\n2. Priority: P0 (user blocked, meeting deadline)\n3. Suggested Team: Engineering (urgent)\n4. Response: "Hi there, we're looking into the export issue right now. In the meantime, would you like us to run a manual export? I can have it ready in 15 minutes."`,
                'content-brief': `# Content Brief: Choosing the Right AI Agent\n\n## Audience\nSMB founders, non-technical.\n\n## Key Message\nYou don't need a PhD to use AI.\n\n## Outline\n1. Introduction\n2. What is an AI agent?\n3. 3 types of agents\n4. 5 questions to ask\n5. Real examples\n6. How to test in 10 minutes\n7. Pitfalls to avoid\n8. Conclusion\n\n## CTA\n"Grab a free 15-min consultation."`,
                'meeting-summary': `1. Key decisions\n- Henderson deal won: $40k ARR, moving to onboarding.\n- Demo-environment reliability escalated to IT after two outages.\n\n2. Action items\n- Marcus — send onboarding kickoff (due Fri)\n- Dana — build Acme retention offer, loop in finance (due Wed)\n- Priya — engage IT on demo downtime (due today)\n\n3. Risks to flag\n- Acme renewal at risk on price; the retention offer is time-sensitive.\n- Repeated demo outages could jeopardize live sales demos.`,
                'invoice-extract': `{\n  "invoice_number": "INV-2043",\n  "vendor": "Northwind Supplies",\n  "invoice_date": "2026-06-14",\n  "due_date": "2026-07-14",\n  "bill_to": "Riverside Cafe",\n  "line_items": [\n    { "description": "Espresso Beans 1kg", "qty": 3, "unit_price": 18.00 },\n    { "description": "Oat Milk Case", "qty": 2, "unit_price": 24.00 }\n  ],\n  "subtotal": 102.00,\n  "tax": 8.16,\n  "total": 110.16\n}`,
                'product-desc': `Fuel every mile, meeting, and rep.\n\nBuilt for people who don't slow down, this 750ml insulated bottle keeps water ice-cold for 24 hours or coffee hot for 12 — then goes wherever you do, no spills, no sweat.\n\n- Double-wall vacuum insulation: 24h cold / 12h hot\n- 100% leak-proof — toss it in your bag with confidence\n- Powder-coated grip that survives the gym floor\n- 5 bold colors to match your kit`,
                'review-reply': `Thank you for taking the time to share this — and I'm genuinely sorry. A 9-day delay, a scratched leg, and a two-day wait for support fall well short of what we aim for. Here's how we'll fix it: a replacement leg ships today and we'll refund your shipping. I've also raised the response-time issue with our support lead. Reply here and I'll personally see it through. — CX Team`,
                'social-post': `Stop scrolling — your next language lesson is already in your podcast feed. 🎧\n\nEchoDeck turns any audio or video into flashcards and timed shadowing loops, so your students practice with real native speech (not textbook scripts).\n\n✅ Auto-transcribe\n✅ Shadow & score pronunciation\n✅ Spaced repetition built in\n\nThe free plan is live — bring your content, we'll build the deck.\n\n👉 echodeck.madlabs.uk\n\n#LanguageLearning #EdTech #TeachersOfLinkedIn`,
                'spreadsheet-formula': `1. Formula (Sheets/Excel):\n=SUMIFS(C2:C1000, B2:B1000, "West", A2:A1000, ">="&DATE(2026,7,1), A2:A1000, "<="&DATE(2026,9,30))\n\n2. Explanation: SUMIFS adds column C where the region equals "West" and the order date is between Jul 1 and Sep 30, 2026 (inclusive).\n\n3. Common mistake: hard-coding dates as strings (">=7/1/2026") — locale differences break it. Wrap them in DATE() so they're unambiguous.`
            },
            'Anthropic': {
                'sales-email': `Subject: Your logistics savings opportunity\n\nHi Alex,\n\nThanks for checking out our pricing guide. I understand you're evaluating ways to reduce costs.\n\nWith your logistics volume, we typically see 20% savings in the first quarter. No carrier changes required—we optimize what you already have.\n\nIf you have 15 minutes this week, I'd love to share how we did this for a similar-sized firm.\n\nCheers,\n[Your Name]`,
                'lead-qualify': `1. Lead Score: 92/100\n2. Priority: High\n3. Recommended next step: Immediate demo with technical SME. Include ROI calculator.\n4. Reasoning: Near-perfect fit: budget, authority, need, and timeline are all aligned.`,
                'support-triage': `1. Category: Bug (UI/Export)\n2. Priority: P0\n3. Suggested Team: Engineering with Support escalation\n4. Response: "I understand the urgency. We're on it. I'll have our team export the data directly. We'll email it within 20 minutes."`,
                'content-brief': `# Content Brief: Picking the Right AI Agent\n\n## Audience\nBusy founders.\n\n## Core Message\nAI agents are tools, not magic.\n\n## Outline\n1. The 2026 AI landscape\n2. Chat vs. workflow vs. custom\n3. The 5-minute test\n4. Red flags\n5. Our top 3 picks\n6. How to run a pilot\n\n## CTA\n"Book a free 15-min AI assessment."`,
                'meeting-summary': `1. Key decisions\n- Closed Henderson ($40k ARR) → begin onboarding.\n- Prioritize fixing the demo environment after two outages this week.\n\n2. Action items\n- Marcus: onboarding kickoff — due Friday\n- Dana: retention offer + finance sign-off — due Wednesday\n- Priya: escalate demo downtime to IT — due today\n\n3. Risks\n- Acme renewal threatened by price sensitivity; the offer must land before Wednesday to matter.\n- Demo instability may undermine active sales demonstrations.`,
                'invoice-extract': `{\n  "invoice_number": "INV-2043",\n  "vendor": "Northwind Supplies",\n  "invoice_date": "2026-06-14",\n  "due_date": "2026-07-14",\n  "bill_to": "Riverside Cafe",\n  "line_items": [\n    { "description": "Espresso Beans 1kg", "qty": 3, "unit_price": 18.0 },\n    { "description": "Oat Milk Case", "qty": 2, "unit_price": 24.0 }\n  ],\n  "subtotal": 102.0,\n  "tax": 8.16,\n  "total": 110.16,\n  "currency": "USD"\n}`,
                'product-desc': `Stay cold. Stay hot. Stay unstoppable.\n\nWhether you're between meetings or between sets, this 750ml insulated bottle holds the line — 24 hours cold or 12 hours hot — and never leaks in your bag.\n\n- Vacuum-sealed walls: 24h cold / 12h hot\n- Genuinely leak-proof lid\n- Powder-coated finish that resists dents and slips\n- Five colors, one for every mood`,
                'review-reply': `I'm sorry — this clearly wasn't the experience we want you to have. A late delivery, a scratched leg, and a slow reply are three misses in a row, and that's on us. We'll send a replacement leg today and refund your shipping cost. I've flagged the support delay internally so it doesn't repeat. Just reply here and we'll make it right. — CX Team`,
                'social-post': `What if every podcast you love could become a language lesson? 🎧\n\nEchoDeck turns audio and video into flashcards and shadowing loops — real native speech, not scripted textbook lines. Teachers can build a deck in minutes and share it with the whole class.\n\nThe free plan just went live.\n\n👉 Start free: echodeck.madlabs.uk\n\n#LanguageLearning #EdTech #Shadowing`,
                'spreadsheet-formula': `1. Formula:\n=SUMIFS(C2:C1000, B2:B1000, "West", A2:A1000, ">="&DATE(2026,7,1), A2:A1000, "<="&DATE(2026,9,30))\n\n2. Explanation: One SUMIFS with three criteria — region = West, date on/after Jul 1, and date on/before Sep 30 — sums the matching revenue.\n\n3. Common mistake: dropping the second date bound, which sums everything from Q3 onward instead of just the quarter.`
            },
            'Google': {
                'sales-email': `Subject: Making the most of your pricing guide\n\nHi Alex,\n\nI saw you grabbed our pricing guide—great choice.\n\nI'm curious: what's the biggest logistics challenge you're facing right now? We've helped ops leaders cut costs by 20% without compromising service.\n\nUp for a quick 15-minute chat this week?\n\nBest,\n[Your Name]`,
                'lead-qualify': `1. Lead Score: 78/100\n2. Priority: Medium-High\n3. Recommended next step: Send a case study and follow up in 1 week.\n4. Reasoning: Good fit and clear need, but the timeline is longer. Nurture with targeted content.`,
                'support-triage': `1. Category: Bug (Data Export)\n2. Priority: P1\n3. Suggested Team: Support + Engineering\n4. Response: "We're on this. We can email you the CSV manually in 30 minutes."`,
                'content-brief': `# Content Brief: AI Agents for SMBs\n\n## Audience\nSmall business owners.\n\n## Message\nAI agents are like smart interns.\n\n## Outline\n1. What is an AI agent?\n2. Why SMBs need them\n3. 3 biggest mistakes\n4. How to test in 10 minutes\n5. Recommendations\n6. Getting started on a budget\n\n## CTA\n"Try our free AI agent selector."`,
                'meeting-summary': `Decisions:\n- Henderson deal closed ($40k ARR).\n- IT to investigate repeated demo downtime.\n\nAction items:\n- Marcus → onboarding kickoff (Fri)\n- Dana → retention offer + finance (Wed)\n- Priya → IT on demo outages (today)\n\nRisks:\n- Acme renewal at risk over pricing.`,
                'invoice-extract': `{\n  "invoice_number": "INV-2043",\n  "vendor": "Northwind Supplies",\n  "invoice_date": "2026-06-14",\n  "due_date": "2026-07-14",\n  "bill_to": "Riverside Cafe",\n  "line_items": [\n    { "description": "Espresso Beans 1kg", "qty": 3, "unit_price": 18.00 },\n    { "description": "Oat Milk Case", "qty": 2, "unit_price": 24.00 }\n  ],\n  "subtotal": 102.00,\n  "tax": 8.16,\n  "total": 110.16\n}`,
                'product-desc': `Your all-day hydration companion.\n\nThis 750ml insulated stainless-steel bottle keeps drinks cold for 24 hours or hot for 12 — perfect for the gym, the commute, and everything between.\n\n- 24h cold / 12h hot\n- Leak-proof design\n- Powder-coated, easy-grip finish\n- Available in 5 colors`,
                'review-reply': `Thanks for the feedback, and we're sorry for the frustration. A 9-day delay, a scratched leg, and a slow support reply aren't okay. We'd like to fix it: we'll send a replacement leg and refund your shipping. We're also reviewing our support response times. Please reply here so we can help. — CX Team`,
                'social-post': `🎧 Turn any podcast into a language lesson.\n\nEchoDeck builds flashcards and shadowing loops from the audio your learners already love — so they practice with real native speech.\n\nFree plan is live now.\n\n👉 echodeck.madlabs.uk\n\n#LanguageLearning #EdTech #Productivity`,
                'spreadsheet-formula': `1. Formula:\n=SUMIFS(C2:C1000, B2:B1000, "West", A2:A1000, ">="&DATE(2026,7,1), A2:A1000, "<="&DATE(2026,9,30))\n\n2. Explanation: Sums "West" revenue for dates within Q3 2026.\n\n3. Mistake to avoid: comparing dates as plain text instead of DATE().`
            },
            'Meta': {
                'sales-email': `Subject: Re: Pricing guide download\n\nHi Alex,\n\nI'm following up on your download of our pricing guide.\n\nWe help logistics companies save 20% on freight costs. I'd love to share some specific examples.\n\nAre you free for a 15-min call this week?\n\nBest,\n[Your Name]`,
                'lead-qualify': `1. Lead Score: 72/100\n2. Priority: Medium\n3. Recommended next step: Send a case study and follow up in 2 weeks.\n4. Reasoning: Good fit but timeline is less urgent. Needs more nurturing.`,
                'support-triage': `1. Category: Bug (Export)\n2. Priority: P1\n3. Suggested Team: Support\n4. Response: "We're fixing the export issue now. I'll manually send you the CSV. Apologies."`,
                'content-brief': `# Content Brief: AI Agents for SMBs\n\n## Audience\nSMB owners.\n\n## Message\nAI agents can save you time.\n\n## Outline\n1. What is an AI agent?\n2. Use cases\n3. How to choose\n4. Next steps\n\n## CTA\n"Book a consultation."`,
                'meeting-summary': `Decisions:\n- Henderson won ($40k ARR).\n\nActions:\n- Marcus: onboarding kickoff — Fri\n- Dana: retention offer + finance — Wed\n- Priya: IT on demo downtime — today\n\nRisks:\n- Acme renewal (price).`,
                'invoice-extract': `{\n  "invoice_number": "INV-2043",\n  "vendor": "Northwind Supplies",\n  "invoice_date": "2026-06-14",\n  "due_date": "2026-07-14",\n  "bill_to": "Riverside Cafe",\n  "line_items": [\n    { "description": "Espresso Beans 1kg", "qty": 3, "unit_price": 18 },\n    { "description": "Oat Milk Case", "qty": 2, "unit_price": 24 }\n  ],\n  "subtotal": 102,\n  "tax": 8.16,\n  "total": 110.16\n}`,
                'product-desc': `Hydration, handled.\n\nA 750ml insulated bottle that keeps drinks cold 24h or hot 12h — leak-proof and gym-ready.\n\n- 24h cold / 12h hot\n- Leak-proof cap\n- Powder-coated finish\n- 5 colors`,
                'review-reply': `We're sorry about the late delivery, the scratched leg, and the slow reply — that's not okay. We'll ship a replacement leg and refund your shipping. We're looking into our support delays too. Please reply here and we'll make it right. — CX Team`,
                'social-post': `Your podcast feed is a language course waiting to happen. 🎧\n\nEchoDeck turns audio into flashcards and shadowing practice. Free plan live now.\n\n👉 echodeck.madlabs.uk\n\n#LanguageLearning #EdTech #Shadowing`,
                'spreadsheet-formula': `1. Formula:\n=SUMIFS(C2:C1000, B2:B1000, "West", A2:A1000, ">="&DATE(2026,7,1), A2:A1000, "<="&DATE(2026,9,30))\n\n2. Explanation: Sums West revenue in Q3 2026.\n\n3. Mistake: writing the dates as text.`
            },
            'xAI': {
                'sales-email': `Subject: Logistics optimization\n\nHi Alex,\n\nThanks for downloading our guide. Grok here.\n\nWe've analyzed thousands of logistics operations and found that AI-driven optimization cuts costs by 20% on average. No carrier changes, just smarter routing.\n\nGot 15 minutes to see how we do it?\n\nCheers,\n[Your Name]`,
                'lead-qualify': `1. Lead Score: 88/100\n2. Priority: High\n3. Next step: Run a quick simulation for them.\n4. Reasoning: Strong intent, good budget.`,
                'support-triage': `1. Category: Bug\n2. Priority: P0\n3. Team: Engineering\n4. Response: "We're on it. Will have the export fixed shortly."`,
                'content-brief': `# Content Brief: AI for SMBs\n\n## Audience\nFounders.\n\n## Outline\n1. The AI revolution\n2. Top agents\n3. How to pick\n\n## CTA\n"Get started."`,
                'meeting-summary': `Decisions:\n- Henderson closed, $40k ARR.\n\nActions:\n- Marcus — onboarding kickoff (Fri)\n- Dana — retention offer, loop finance (Wed)\n- Priya — IT on demo outages (today)\n\nRisks:\n- Acme renewal shaky on price. Move fast.`,
                'invoice-extract': `{\n  "invoice_number": "INV-2043",\n  "vendor": "Northwind Supplies",\n  "invoice_date": "2026-06-14",\n  "due_date": "2026-07-14",\n  "bill_to": "Riverside Cafe",\n  "line_items": [\n    {"description": "Espresso Beans 1kg", "qty": 3, "unit_price": 18.00},\n    {"description": "Oat Milk Case", "qty": 2, "unit_price": 24.00}\n  ],\n  "subtotal": 102.00, "tax": 8.16, "total": 110.16\n}`,
                'product-desc': `Built to keep up. So are you.\n\n750ml of vacuum-insulated steel that holds cold for 24h or hot for 12h — leak-proof, drop-tough, ready for anything.\n\n- 24h cold / 12h hot\n- Zero leaks\n- Powder-coated grip\n- 5 colors`,
                'review-reply': `Sorry we let you down — 9 days late, a scratched leg, and a slow reply is three strikes. Here's the fix: replacement leg ships today, shipping refunded. We're tightening up support response times too. Reply here and we'll handle it. — CX Team`,
                'social-post': `Podcasts in. Fluency out. 🎧\n\nEchoDeck turns any audio into flashcards + shadowing loops with real native speech. Free plan is live — bring your content.\n\n👉 echodeck.madlabs.uk\n\n#LanguageLearning #EdTech #AI`,
                'spreadsheet-formula': `1. =SUMIFS(C2:C1000, B2:B1000, "West", A2:A1000, ">="&DATE(2026,7,1), A2:A1000, "<="&DATE(2026,9,30))\n\n2. Sums West revenue in Q3 2026.\n\n3. Don't type dates as strings — use DATE() to dodge locale bugs.`
            },
            'DeepSeek': {
                'sales-email': `Subject: Cost savings for your logistics\n\nHi Alex,\n\nThanks for your interest in our pricing guide.\n\nWe've built a cost-optimization engine that consistently delivers 20% savings for logistics ops. Would love to walk you through a quick demo.\n\nAvailable this week?\n\nBest,\n[Your Name]`,
                'lead-qualify': `1. Score: 80/100\n2. Priority: High\n3. Next: Send technical whitepaper.`,
                'support-triage': `1. Bug\n2. P0\n3. Engineering\n4. "Fixing now."`,
                'content-brief': `# AI Agents for SMBs\n\n## Outline\n1. Intro\n2. Use cases\n3. Picks\n\n## CTA\n"Learn more."`
            },
            'Mistral': {
                'sales-email': `Subject: Optimizing your logistics with AI\n\nHi Alex,\n\nThanks for downloading our guide. We've been helping ops teams slash logistics costs by 20% in record time.\n\nNo complicated setup, just pure optimization.\n\nGot 15 minutes this week to see how?\n\nCheers,\n[Your Name]`,
                'lead-qualify': `1. Score: 80/100\n2. Priority: High\n3. Next: Send personalized ROI model.`,
                'support-triage': `1. Bug\n2. P0\n3. Engineering\n4. "We'll send the CSV in 15 min."`,
                'content-brief': `# AI Agents for SMBs – A Practical Guide\n\n## Audience\nFounders.\n\n## Outline\n1. Why AI agents\n2. 5 use cases\n3. How to pick\n\n## CTA\n"Start your free trial."`
            },
            'Cohere': {
                'sales-email': `Subject: Your logistics data\n\nHi Alex,\n\nWe noticed you downloaded our pricing guide. Cohere's models can help you extract insights from your logistics data to find savings.\n\nUp for a quick chat?\n\nBest,\n[Your Name]`,
                'lead-qualify': `1. Score: 75/100\n2. Priority: Medium\n3. Next: Send data sheet.`,
                'support-triage': `1. Bug\n2. P1\n3. Support\n4. "We'll look into it."`,
                'content-brief': `# AI Agents\n\n## Outline\n1. Intro\n2. Use cases\n\n## CTA\n"Contact us."`
            },
            'AI21': {
                'sales-email': `Subject: Jamba for logistics\n\nHi Alex,\n\nThanks for downloading the guide. Jamba's architecture is uniquely suited for long-context logistics analysis.\n\nLet's chat?\n\nBest,\n[Your Name]`,
                'lead-qualify': `1. Score: 70/100\n2. Priority: Medium\n3. Next: Send technical brief.`,
                'support-triage': `1. Bug\n2. P1\n3. Support\n4. "We'll fix it."`,
                'content-brief': `# AI Agents for SMBs\n\n## Outline\n1. Overview\n2. Recommendations\n\n## CTA\n"Learn more."`
            },
            'Alibaba (Qwen)': {
                'sales-email': `Subject: Qwen for logistics\n\nHi Alex,\n\nQwen 2.5 is a top performer on reasoning tasks. Let's see how it can optimize your supply chain.\n\n15-min call?\n\nBest,\n[Your Name]`,
                'lead-qualify': `1. Score: 82/100\n2. Priority: High\n3. Next: Demo.`,
                'support-triage': `1. Bug\n2. P0\n3. Engineering\n4. "Fixing."`,
                'content-brief': `# AI Agents Guide\n\n## Outline\n1. Intro\n2. Use cases\n\n## CTA\n"Get started."`
            },
            'Perplexity': {
                'sales-email': `Subject: Sonar for logistics\n\nHi Alex,\n\nSonar's real-time web grounding can help you benchmark freight costs instantly.\n\nLet's chat?\n\nBest,\n[Your Name]`,
                'lead-qualify': `1. Score: 76/100\n2. Priority: Medium\n3. Next: Send benchmarks.`,
                'support-triage': `1. Bug\n2. P1\n3. Support\n4. "Checking."`,
                'content-brief': `# AI Agents\n\n## Outline\n1. Intro\n2. Picks\n\n## CTA\n"Try it."`
            },
            'Community': {
                'sales-email': `Subject: Let's save you 20% on logistics\n\nHi Alex,\n\nYou checked out our pricing guide—thanks!\n\nI'm reaching out because we've helped ops leaders cut logistics costs by 20% in the first quarter. No carrier changes, just smarter optimization.\n\nGot 15 minutes this week? I'd love to share a quick case study.\n\nLet me know,\n[Your Name]`,
                'lead-qualify': `1. Lead Score: 88/100\n2. Priority: High\n3. Recommended next step: Schedule a discovery call.\n4. Reasoning: Strong fit across all dimensions. Engagement indicates serious interest.`,
                'support-triage': `1. Category: Bug (Export)\n2. Priority: P0\n3. Suggested Team: Engineering\n4. Response: "I'm so sorry. I'll manually run the export for you and send it over in 15 minutes."`,
                'content-brief': `# The SMB Guide to AI Agents\n\n## Audience\nNon-technical founders.\n\n## Message\nAI agents are the best new hires you'll ever make.\n\n## Outline\n1. AI agents: The new assistant\n2. 5 tasks to hand off\n3. How to pick the right agent\n4. Our top picks\n5. 3 free tools to start\n\n## CTA\n"Get your free AI task assessment."`,
                'meeting-summary': `📋 Decisions\n- Henderson: closed, $40k ARR.\n\n✅ Action items\n- Marcus: onboarding kickoff (Fri)\n- Dana: retention offer + finance (Wed)\n- Priya: IT on demo downtime (today)\n\n⚠️ Risks\n- Acme renewal at risk over pricing — address before Wednesday.`,
                'invoice-extract': `{\n  "invoice_number": "INV-2043",\n  "vendor": "Northwind Supplies",\n  "invoice_date": "2026-06-14",\n  "due_date": "2026-07-14",\n  "bill_to": "Riverside Cafe",\n  "line_items": [\n    { "description": "Espresso Beans 1kg", "qty": 3, "unit_price": 18.00 },\n    { "description": "Oat Milk Case", "qty": 2, "unit_price": 24.00 }\n  ],\n  "subtotal": 102.00,\n  "tax": 8.16,\n  "total": 110.16\n}`,
                'product-desc': `💧 Hydration that never quits.\n\nThis 750ml insulated bottle keeps drinks cold for a full 24 hours or hot for 12 — leak-proof and ready for the gym, the trail, or the desk.\n\n- ❄️ 24h cold / 🔥 12h hot\n- 🚫 100% leak-proof\n- 💪 Powder-coated, drop-friendly finish\n- 🎨 5 colors`,
                'review-reply': `We're really sorry — a late delivery, a scratched leg, and a slow reply is not the experience you deserved. Let's fix it: a replacement leg goes out today and we'll refund your shipping. We've flagged the support delay so it won't happen again. Reply here anytime. — CX Team`,
                'social-post': `🎧 Every podcast is a free language lesson in disguise.\n\nEchoDeck turns audio into flashcards + shadowing loops so learners train with real native speech. Teachers: build a deck in minutes, share it with your class.\n\n✨ Free plan is live.\n👉 echodeck.madlabs.uk\n\n#LanguageLearning #EdTech #TeachersOfLinkedIn`,
                'spreadsheet-formula': `1. Formula:\n=SUMIFS(C2:C1000, B2:B1000, "West", A2:A1000, ">="&DATE(2026,7,1), A2:A1000, "<="&DATE(2026,9,30))\n\n2. Explanation: SUMIFS with a region match plus two date bounds nets just West / Q3 2026 revenue.\n\n3. Gotcha: mixing text dates with & concatenation — always wrap in DATE().`
            }
        };

            const DEFAULT_MOCK = {
            'sales-email': `Subject: Quick question\n\nHi Alex,\n\nJust following up on your interest in our pricing guide. Would love to chat.\n\nBest,\n[Your Name]`,
            'lead-qualify': `1. Score: 75/100\n2. Priority: Medium\n3. Next: Follow up.`,
            'support-triage': `1. Bug\n2. P1\n3. Support\n4. "We'll look into it."`,
            'content-brief': `# Content Brief\n\n## Outline\n1. Intro\n2. Use cases\n\n## CTA\n"Learn more."`,
            'meeting-summary': `Decisions:\n- Henderson deal closed ($40k ARR).\n\nAction items:\n- Marcus: onboarding kickoff — Fri\n- Dana: retention offer + finance — Wed\n- Priya: IT on demo downtime — today\n\nRisks:\n- Acme renewal at risk over pricing.`,
            'invoice-extract': `{\n  "invoice_number": "INV-2043",\n  "vendor": "Northwind Supplies",\n  "invoice_date": "2026-06-14",\n  "due_date": "2026-07-14",\n  "bill_to": "Riverside Cafe",\n  "line_items": [\n    { "description": "Espresso Beans 1kg", "qty": 3, "unit_price": 18.00 },\n    { "description": "Oat Milk Case", "qty": 2, "unit_price": 24.00 }\n  ],\n  "subtotal": 102.00,\n  "tax": 8.16,\n  "total": 110.16\n}`,
            'product-desc': `Hydration that keeps up with your day.\n\nThis 750ml insulated bottle keeps drinks cold for 24 hours or hot for 12 — leak-proof and built to take a beating.\n\n- Vacuum insulation: 24h cold / 12h hot\n- 100% leak-proof cap\n- Durable powder-coated finish\n- 5 colors to choose from`,
            'review-reply': `Thank you for the honest feedback, and I'm sorry. A late delivery, a scratched leg, and a slow reply aren't what we promise. We'd like to make it right: we'll ship a replacement leg today and refund your shipping. I've also flagged the support delay with my team. Please reply here and we'll sort it out. — CX Team`,
            'social-post': `🎧 Your favorite podcast could be your next language lesson.\n\nEchoDeck turns any audio or video into flashcards and shadowing loops — so learners practice with real, native speech.\n\nFree plan is live. Bring your content, we'll build the deck.\n\n👉 echodeck.madlabs.uk\n\n#LanguageLearning #EdTech #Shadowing`,
            'spreadsheet-formula': `1. Formula:\n=SUMIFS(C2:C1000, B2:B1000, "West", A2:A1000, ">="&DATE(2026,7,1), A2:A1000, "<="&DATE(2026,9,30))\n\n2. Explanation: SUMIFS sums revenue where region is "West" and the date falls in Q3 2026.\n\n3. Common mistake: typing the dates as text (">=2026-07-01") instead of DATE() — it breaks the comparison.`
        };

    return { tasks, providerMocks: PROVIDER_MOCKS, defaultMock: DEFAULT_MOCK };
})();
