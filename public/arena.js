        // ----------------------------------------------------------------
        //  MODEL REGISTRY — a static demo snapshot (early 2026).
        //  Costs and latencies are illustrative, not live pricing.
        // ----------------------------------------------------------------
        // Embedded fallback catalog — used only if the live registry
        // (GET /api/arena/models) can't be reached (offline / static hosting).
        // Normally the server is the source of truth and this is replaced.
        let PROVIDER_DATA = {
            'OpenAI': {
                color: '#10a37f',
                models: [
                    { id: 'gpt-5.1', name: 'GPT-5.1', costPer1k: 0.01, latency: 1.6, trend: '🔥 New' },
                    { id: 'gpt-5', name: 'GPT-5', costPer1k: 0.01, latency: 1.8 },
                    { id: 'gpt-5-mini', name: 'GPT-5 mini', costPer1k: 0.002, latency: 0.9 },
                    { id: 'gpt-5-nano', name: 'GPT-5 nano', costPer1k: 0.0004, latency: 0.5 },
                    { id: 'o4-mini', name: 'o4-mini', costPer1k: 0.004, latency: 1.4 },
                    { id: 'gpt-4.1', name: 'GPT-4.1', costPer1k: 0.008, latency: 1.2 }
                ]
            },
            'Anthropic': {
                color: '#d97757',
                models: [
                    { id: 'claude-opus-4.5', name: 'Claude Opus 4.5', costPer1k: 0.025, latency: 1.9, trend: '🔥 New' },
                    { id: 'claude-sonnet-4.5', name: 'Claude Sonnet 4.5', costPer1k: 0.015, latency: 1.3 },
                    { id: 'claude-haiku-4.5', name: 'Claude Haiku 4.5', costPer1k: 0.005, latency: 0.6 },
                    { id: 'claude-opus-4.1', name: 'Claude Opus 4.1', costPer1k: 0.075, latency: 2.2 }
                ]
            },
            'Google': {
                color: '#4285f4',
                models: [
                    { id: 'gemini-3-pro', name: 'Gemini 3 Pro', costPer1k: 0.012, latency: 1.7, trend: '🔥 New' },
                    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', costPer1k: 0.01, latency: 1.5 },
                    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', costPer1k: 0.0025, latency: 0.7 },
                    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite', costPer1k: 0.0004, latency: 0.4 }
                ]
            },
            'Meta': {
                color: '#e65c2e',
                models: [
                    { id: 'llama-4-maverick', name: 'Llama 4 Maverick', costPer1k: 0.0006, latency: 1.1 },
                    { id: 'llama-4-scout', name: 'Llama 4 Scout', costPer1k: 0.0003, latency: 0.8 },
                    { id: 'llama-3.3-70b', name: 'Llama 3.3 70B', costPer1k: 0.0007, latency: 1.4 },
                    { id: 'llama-3.1-8b', name: 'Llama 3.1 8B', costPer1k: 0.0002, latency: 0.6 }
                ]
            },
            'xAI': {
                color: '#000000',
                models: [
                    { id: 'grok-4.1', name: 'Grok 4.1', costPer1k: 0.015, latency: 1.6, trend: '🔥 New' },
                    { id: 'grok-4', name: 'Grok 4', costPer1k: 0.015, latency: 1.8 },
                    { id: 'grok-4-fast', name: 'Grok 4 Fast', costPer1k: 0.0005, latency: 0.6 }
                ]
            },
            'DeepSeek': {
                color: '#4d6bfe',
                models: [
                    { id: 'deepseek-v3.2', name: 'DeepSeek-V3.2', costPer1k: 0.0004, latency: 1.2 },
                    { id: 'deepseek-r1', name: 'DeepSeek-R1', costPer1k: 0.002, latency: 2.0 }
                ]
            },
            'Mistral': {
                color: '#f7a71e',
                models: [
                    { id: 'mistral-large-3', name: 'Mistral Large 3', costPer1k: 0.006, latency: 1.5 },
                    { id: 'mistral-medium-3', name: 'Mistral Medium 3', costPer1k: 0.002, latency: 1.0 },
                    { id: 'mistral-small-3.2', name: 'Mistral Small 3.2', costPer1k: 0.0003, latency: 0.6 },
                    { id: 'magistral', name: 'Magistral', costPer1k: 0.005, latency: 1.7 }
                ]
            },
            'Cohere': {
                color: '#ff6b6b',
                models: [
                    { id: 'command-a', name: 'Command A', costPer1k: 0.01, latency: 1.3 },
                    { id: 'command-r-plus', name: 'Command R+', costPer1k: 0.01, latency: 1.6 }
                ]
            },
            'AI21': {
                color: '#00a3e0',
                models: [
                    { id: 'jamba-1.7-large', name: 'Jamba 1.7 Large', costPer1k: 0.008, latency: 1.8 },
                    { id: 'jamba-1.7-mini', name: 'Jamba 1.7 Mini', costPer1k: 0.0004, latency: 0.8 }
                ]
            },
            'Alibaba (Qwen)': {
                color: '#ff6a00',
                models: [
                    { id: 'qwen3-235b', name: 'Qwen3 235B', costPer1k: 0.0009, latency: 1.6 },
                    { id: 'qwen3-32b', name: 'Qwen3 32B', costPer1k: 0.0004, latency: 0.9 },
                    { id: 'qwq-32b', name: 'QwQ 32B', costPer1k: 0.0004, latency: 1.3 }
                ]
            },
            'Perplexity': {
                color: '#1f1f1f',
                models: [
                    { id: 'sonar-pro', name: 'Sonar Pro', costPer1k: 0.009, latency: 1.4 },
                    { id: 'sonar', name: 'Sonar', costPer1k: 0.001, latency: 0.7 }
                ]
            },
            'Community': {
                color: '#7c3aed',
                models: [
                    { id: 'hermes-4', name: 'Hermes 4', costPer1k: 0.001, latency: 0.8, trend: '🔥 +2650%' },
                    { id: 'openhermes', name: 'OpenHermes', costPer1k: 0.0006, latency: 0.9 },
                    { id: 'dolphin-3', name: 'Dolphin 3.0', costPer1k: 0.0005, latency: 1.0 }
                ]
            }
        };

        // ----------------------------------------------------------------
        //  AUTO-UPDATE ENGINE
        //  The model list is served by GET /api/arena/models. The client
        //  fetches it on load, polls it periodically, and auto-adds any newly
        //  released models to the agent list. New models are added server-side
        //  (from a live feed when ARENA_MODELS_URL is set, or a demo release
        //  simulation otherwise) — see server/arena-models.js.
        // ----------------------------------------------------------------
        const MODELS_ENDPOINT = '/api/arena/models';
        const MODELS_POLL_MS = 45000;
        let versionCounter = 1;
        let lastSyncTime = null;
        let knownModelIds = new Set();

        // Flatten for state
        function buildFlatAgents() {
            const flat = [];
            Object.keys(PROVIDER_DATA).forEach(provider => {
                const providerInfo = PROVIDER_DATA[provider];
                providerInfo.models.forEach(model => {
                    flat.push({
                        ...model,
                        provider: provider,
                        color: providerInfo.color,
                        trend: model.trend || null
                    });
                });
            });
            return flat;
        }

        // ----------------------------------------------------------------
        //  STATE
        // ----------------------------------------------------------------
        const state = {
            currentStep: 1,
            selectedTask: null,
            selectedAgents: [],
            isRunning: false,
            results: [],
            agents: buildFlatAgents(),
            tasks: [{
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
            }]
        };

        // ----------------------------------------------------------------
        //  MOCK RESPONSES (Per Provider "Personality")
        // ----------------------------------------------------------------
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

        function getMockResponse(agentId, taskId) {
            const agent = state.agents.find(a => a.id === agentId);
            // Custom tasks have no canned mock — in simulation we return a
            // placeholder (real output comes from live runs on the Ultimate plan).
            if (taskId === 'custom') {
                return `[Simulated preview]\n\nThis is where ${agent ? agent.name : 'the model'} would answer your custom prompt.\n\nEnable live runs to see the real response.`;
            }
            if (!agent) return DEFAULT_MOCK[taskId] || 'No response.';
            const provider = agent.provider;
            const providerMocks = PROVIDER_MOCKS[provider];
            if (providerMocks && providerMocks[taskId]) return providerMocks[taskId];
            return DEFAULT_MOCK[taskId] || 'No response.';
        }

        // ----------------------------------------------------------------
        //  DOM REFS
        // ----------------------------------------------------------------
        const $ = id => document.getElementById(id);
        const taskGrid = $('taskGrid');
        const agentAccordion = $('agentAccordion');
        const stepPanel1 = $('stepPanel1');
        const stepPanel2 = $('stepPanel2');
        const stepPanel3 = $('stepPanel3');
        const runSummary = $('runSummary');
        const runBtn = $('runBtn');
        const backBtn = $('backBtn');
        const resultsDiv = $('results');
        const comparisonGrid = $('comparisonGrid');
        const scorecardGrid = $('scorecardGrid');
        const themeToggle = $('themeToggle');
        const footerLabel = $('footerThemeLabel');
        const agentCountSpan = $('agentCount');
        const versionBadge = $('versionBadge');
        const lastSyncDisplay = $('lastSyncDisplay');
        const syncBtn = $('syncBtn');
        const syncStatus = $('syncStatus');
        const toast = $('toast');
        const toastMessage = $('toastMessage');
        const taskCountSpan = $('taskCount');
        const runCountSpan = $('runCount');
        const publishBar = $('publishBar');
        const publishLink = $('publishLink');
        const communityPanel = $('communityPanel');
        const communityGrid = $('communityGrid');

        let toastTimeout = null;
        let runCount = 0;

        // Relative-time formatter for community scorecard timestamps.
        function timeAgo(ts) {
            const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
            if (s < 60) return `${s}s ago`;
            const m = Math.floor(s / 60);
            if (m < 60) return `${m}m ago`;
            const h = Math.floor(m / 60);
            if (h < 24) return `${h}h ago`;
            return `${Math.floor(h / 24)}d ago`;
        }

        function escapeHtml(str) {
            return String(str).replace(/[&<>"']/g, c => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
            }[c]));
        }

        // Deterministic PRNG so the same agent+task pair always scores the
        // same — reruns are stable instead of reshuffling the leaderboard.
        function seededRandom(seedStr) {
            let h = 2166136261;
            for (let i = 0; i < seedStr.length; i++) {
                h ^= seedStr.charCodeAt(i);
                h = Math.imul(h, 16777619);
            }
            return function () {
                h = Math.imul(h ^ (h >>> 15), 2246822507);
                h = Math.imul(h ^ (h >>> 13), 3266489909);
                h ^= h >>> 16;
                return (h >>> 0) / 4294967296;
            };
        }

        // Make a rendered element keyboard-operable (Enter / Space = click).
        function keyActivate(el) {
            el.setAttribute('tabindex', '0');
            if (!el.getAttribute('role')) el.setAttribute('role', 'button');
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    el.click();
                }
            });
        }

        function showToast(message, icon = '🔄') {
            toastMessage.textContent = message;
            toast.querySelector('.icon').textContent = icon;
            toast.classList.add('show');
            clearTimeout(toastTimeout);
            toastTimeout = setTimeout(() => toast.classList.remove('show'), 3500);
        }

        // ----------------------------------------------------------------
        //  RENDER FUNCTIONS
        // ----------------------------------------------------------------
        function renderTasks() {
            const starterLimit = Account.taskLimit();        // how many preset tasks are unlocked
            const allowCustom = Account.customTasksAllowed(); // top tier only
            let html = state.tasks.map((task, i) => {
                const locked = i >= starterLimit;
                return `
                <div class="task-card ${state.selectedTask?.id === task.id ? 'active' : ''} ${locked ? 'locked' : ''}" data-id="${escapeHtml(task.id)}" aria-pressed="${state.selectedTask?.id === task.id}">
                    <span class="emoji">${task.emoji}</span>
                    <div class="info">
                        <strong>${escapeHtml(task.title)}</strong>
                        <p>${escapeHtml(task.desc)}</p>
                        <div class="task-meta">${escapeHtml(task.difficulty)} · ${task.prompt.length} chars</div>
                    </div>
                    ${locked ? '<span class="lock" title="Upgrade to unlock">🔒</span>' : ''}
                </div>`;
            }).join('');
            // Custom-task authoring card (Ultimate). Locked card for others (an upsell).
            html += `
                <div class="task-card custom ${allowCustom ? '' : 'locked'}" id="customTaskCard" data-id="custom">
                    <span class="emoji">✍️</span>
                    <div class="info">
                        <strong>Custom task</strong>
                        <p>Write your own prompt and benchmark models on it.</p>
                        <div class="task-meta">${allowCustom ? 'Your workflow' : 'Ultimate plan'}</div>
                    </div>
                    ${allowCustom ? '' : '<span class="lock" title="Ultimate plan">🔒</span>'}
                </div>
                <div class="custom-panel ${state.selectedTask?.id === 'custom' ? 'show' : ''}" id="customPanel">
                    <input id="customTitle" placeholder="Task name (e.g. Refund reply)" maxlength="60" value="${escapeHtml(state.selectedTask?.custom ? state.selectedTask.title : '')}" />
                    <textarea id="customPrompt" placeholder="Write the prompt you want to test the agents on…" maxlength="4000">${escapeHtml(state.selectedTask?.custom ? state.selectedTask.prompt : '')}</textarea>
                    <button class="btn btn-primary" id="useCustomBtn">Use this task →</button>
                </div>`;
            taskGrid.innerHTML = html;

            taskGrid.querySelectorAll('.task-card').forEach(el => {
                keyActivate(el);
                el.addEventListener('click', () => {
                    const id = el.dataset.id;
                    if (id === 'custom') {
                        if (!allowCustom) { showToast('Custom tasks are an Ultimate-plan feature.', '🔒'); Account.openPricing(); return; }
                        $('customPanel').classList.add('show');
                        setTimeout(() => $('customPrompt').focus(), 30);
                        return;
                    }
                    const idx = state.tasks.findIndex(t => t.id === id);
                    if (idx >= starterLimit) { showToast('That workflow is on a paid plan.', '🔒'); Account.openPricing(); return; }
                    state.selectedTask = state.tasks.find(t => t.id === id);
                    renderTasks();
                    updateStep(2);
                });
            });

            const useCustom = $('useCustomBtn');
            if (useCustom) {
                useCustom.addEventListener('click', () => {
                    const title = $('customTitle').value.trim() || 'Custom task';
                    const prompt = $('customPrompt').value.trim();
                    if (prompt.length < 10) { showToast('Write a longer prompt (10+ characters).', '⚠️'); return; }
                    state.selectedTask = { id: 'custom', title, emoji: '✍️', desc: 'Your custom workflow', difficulty: 'Custom', prompt, custom: true };
                    renderTasks();
                    updateStep(2);
                });
            }
        }

        function renderAgents() {
            const groups = {};
            state.agents.forEach(agent => {
                if (!groups[agent.provider]) groups[agent.provider] = [];
                groups[agent.provider].push(agent);
            });

            // Remember which groups the user collapsed so re-renders
            // (e.g. after toggling a chip) don't pop them all open again.
            const collapsed = new Set(
                Array.from(agentAccordion.querySelectorAll('.agent-group-body.hidden'))
                    .map(el => el.previousElementSibling?.dataset.provider)
            );

            let html = '';
            Object.keys(groups).forEach(provider => {
                const models = groups[provider];
                const color = models[0].color;
                const isOpen = !collapsed.has(provider);
                html += `
                    <div class="agent-group">
                        <div class="agent-group-header" data-provider="${escapeHtml(provider)}">
                            <div class="provider-info">
                                <span class="dot" style="background:${color}"></span>
                                <span class="pname">${escapeHtml(provider)}</span>
                                <span class="pcount">${models.length} models</span>
                            </div>
                            <span class="arrow ${isOpen ? 'open' : ''}">▼</span>
                        </div>
                        <div class="agent-group-body ${isOpen ? '' : 'hidden'}">
                            ${models.map(agent => {
                                const selected = state.selectedAgents.includes(agent.id);
                                const trendHtml = agent.trend ? `<span class="trend">${escapeHtml(agent.trend)}</span>` : '';
                                return `
                                    <div class="agent-chip ${selected ? 'selected' : ''}" data-id="${escapeHtml(agent.id)}" aria-pressed="${selected}">
                                        <span class="mini-avatar" style="background:${agent.color}" aria-hidden="true">${escapeHtml(agent.name[0])}</span>
                                        <span class="aname">${escapeHtml(agent.name)}</span>
                                        ${trendHtml}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            });

            agentAccordion.innerHTML = html;

            agentAccordion.querySelectorAll('.agent-group-header').forEach(header => {
                keyActivate(header);
                header.addEventListener('click', () => {
                    const body = header.nextElementSibling;
                    const arrow = header.querySelector('.arrow');
                    body.classList.toggle('hidden');
                    arrow.classList.toggle('open');
                });
            });

            agentAccordion.querySelectorAll('.agent-chip').forEach(chip => {
                keyActivate(chip);
                chip.addEventListener('click', () => toggleAgent(chip.dataset.id));
            });

            agentCountSpan.textContent = state.agents.length;
            versionBadge.textContent = `📦 v${versionCounter}`;
            if (lastSyncTime) {
                lastSyncDisplay.textContent = new Date(lastSyncTime).toLocaleTimeString();
            }
        }

        function toggleAgent(id) {
            const idx = state.selectedAgents.indexOf(id);
            if (idx > -1) {
                state.selectedAgents.splice(idx, 1);
            } else {
                const cap = Account.maxModels();
                if (state.selectedAgents.length < cap) {
                    state.selectedAgents.push(id);
                } else {
                    showToast(`Your plan compares up to ${cap} models. Upgrade for more.`, '🔒');
                    Account.openPricing();
                }
            }
            renderAgents();
            updateRunSummary();
        }

        function updateRunSummary() {
            const taskName = state.selectedTask ? state.selectedTask.title : 'No task';
            const count = state.selectedAgents.length;
            runSummary.innerHTML = `Ready to run <strong>${count}</strong> agent${count > 1 ? 's' : ''} on <strong>${taskName}</strong>`;
        }

        function updateStep(step) {
            state.currentStep = step;
            stepPanel1.style.display = step === 1 ? 'block' : 'none';
            stepPanel2.style.display = step === 2 ? 'block' : 'none';
            stepPanel3.style.display = step === 3 ? 'block' : 'none';

            document.querySelectorAll('.step-dot').forEach(dot => {
                const s = parseInt(dot.dataset.step);
                dot.classList.toggle('active', s === step);
                dot.classList.toggle('done', s < step);
            });
            document.querySelectorAll('.step-line').forEach(line => {
                const idx = parseInt(line.id.replace('line', ''));
                line.classList.toggle('done', idx < step);
            });

            if (step === 3) updateRunSummary();
        }

        // ----------------------------------------------------------------
        //  AUTO-UPDATE ENGINE
        // ----------------------------------------------------------------
        function currentModelIdSet() {
            return new Set(state.agents.map(a => a.id));
        }

        // Fetch the live registry and merge it in. Any model ids not seen
        // before are treated as newly released and surfaced to the user.
        async function refreshModels({ manual = false, silent = false } = {}) {
            if (manual) {
                syncBtn.disabled = true;
                syncBtn.textContent = '⏳ Checking…';
                syncStatus.textContent = 'Checking registry…';
            }
            try {
                const res = await fetch(MODELS_ENDPOINT, { headers: { accept: 'application/json' } });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                if (!data || !data.providers) throw new Error('bad payload');

                const before = knownModelIds.size ? knownModelIds : currentModelIdSet();
                PROVIDER_DATA = data.providers;
                state.agents = buildFlatAgents();
                const after = currentModelIdSet();
                const added = [...after].filter(id => !before.has(id));
                knownModelIds = after;

                if (typeof data.version === 'number') versionCounter = data.version;
                lastSyncTime = data.updatedAt || Date.now();

                // Drop any selected agents that no longer exist in the registry.
                state.selectedAgents = state.selectedAgents.filter(id => after.has(id));

                renderAgents();
                updateRunSummary();

                if (added.length && !silent) {
                    const names = added.map(id => state.agents.find(a => a.id === id)?.name).filter(Boolean);
                    syncStatus.textContent = `✅ Added ${added.length} new`;
                    showToast(`🆕 New model${added.length > 1 ? 's' : ''} available: ${names.join(', ')}`, '📦');
                } else if (manual) {
                    syncStatus.textContent = '✅ Up to date';
                }
                return added.length;
            } catch (e) {
                console.error('Model refresh failed', e);
                if (manual) { syncStatus.textContent = '❌ Offline — using cached list'; }
                return 0;
            } finally {
                if (manual) {
                    syncBtn.disabled = false;
                    syncBtn.textContent = '🔄 Sync Models';
                }
            }
        }

        // ----------------------------------------------------------------
        //  TYPEWRITER
        // ----------------------------------------------------------------
        function typeWriter(element, text, speed = 8) {
            return new Promise((resolve) => {
                let idx = 0;
                element.innerHTML = '';
                const cursor = document.createElement('span');
                cursor.className = 'cursor';
                element.appendChild(cursor);

                function tick() {
                    if (idx < text.length) {
                        const char = text[idx];
                        const textNode = document.createTextNode(char);
                        element.insertBefore(textNode, cursor);
                        idx++;
                        const delay = char === '\n' ? 30 : speed + Math.random() * 10;
                        setTimeout(tick, delay);
                    } else {
                        cursor.remove();
                        resolve();
                    }
                }
                tick();
            });
        }

        // ----------------------------------------------------------------
        //  RUN ARENA
        // ----------------------------------------------------------------
        async function runArena() {
            try {
                if (state.isRunning) return;
                if (state.selectedAgents.length < 2) {
                    showToast('Please select at least 2 agents.', '⚠️');
                    return;
                }
                if (!state.selectedTask) {
                    showToast('Please select a task.', '⚠️');
                    return;
                }

                state.isRunning = true;
                runBtn.disabled = true;
                runBtn.textContent = '⏳ Running...';
                resultsDiv.style.display = 'block';
                comparisonGrid.innerHTML = '';
                scorecardGrid.innerHTML = '';
                resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });

                const task = state.selectedTask;
                const selected = state.agents.filter(a => state.selectedAgents.includes(a.id));

                const cards = {};
                selected.forEach(agent => {
                    const card = document.createElement('div');
                    card.className = 'result-card';
                    card.dataset.agent = agent.id;
                    card.innerHTML = `
                        <div class="card-head">
                            <div class="agent-info">
                                <div class="avatar" style="background:${agent.color}">${escapeHtml(agent.name[0])}</div>
                                <div><strong>${escapeHtml(agent.name)}</strong> <span style="font-size:0.75rem;color:var(--text-secondary);">${escapeHtml(agent.provider)}</span></div>
                            </div>
                            <div class="score-badge" style="background:var(--bg-input);">—</div>
                        </div>
                        <div class="card-body">
                            <div class="output" id="output-${agent.id}"></div>
                        </div>
                        <div class="card-footer">
                            <span>⏱️ <span id="latency-${agent.id}">—</span>s</span>
                            <span>🧾 <span id="tokens-${agent.id}">—</span> tok</span>
                            <span>💰 <span id="cost-${agent.id}">—</span></span>
                            <div class="dimension-bar">
                                <span class="dim">Acc <span class="bar"><span class="fill" id="acc-${agent.id}" style="width:0%"></span></span></span>
                                <span class="dim">Rel <span class="bar"><span class="fill" id="rel-${agent.id}" style="width:0%"></span></span></span>
                                <span class="dim">Spd <span class="bar"><span class="fill" id="spd-${agent.id}" style="width:0%"></span></span></span>
                                <span class="dim">$ <span class="bar"><span class="fill" id="costbar-${agent.id}" style="width:0%"></span></span></span>
                            </div>
                        </div>
                    `;
                    comparisonGrid.appendChild(card);
                    cards[agent.id] = card;
                });

                runCount++;
                runCountSpan.textContent = runCount;

                const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
                const setWidth = (id, val) => { const el = document.getElementById(id); if (el) el.style.width = `${val}%`; };

                // Try a real run first. Disabled by default → the server replies
                // { enabled:false } and every card falls back to simulation. When
                // enabled, only providers with a server adapter come back live.
                const liveById = {};
                let runCharge = null;
                try {
                    const res = await fetch('/api/arena/run', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', ...(Account.token() ? { 'X-Session': Account.token() } : {}) },
                        body: JSON.stringify({ taskId: task.id, prompt: task.prompt, models: selected.map(a => ({ id: a.id, provider: a.provider })) }),
                    });
                    if (res.ok) {
                        const data = await res.json();
                        if (data.enabled && Array.isArray(data.results)) {
                            for (const r of data.results) if (r.live) liveById[r.id] = r;
                            if (typeof data.balance === 'number') runCharge = { charged: data.charged || 0, balance: data.balance };
                        } else if (data.reason === 'signin') {
                            showToast('Sign in to run real models — running the simulation instead.', '🔒');
                            Account.openAuth();
                        } else if (data.reason === 'no-credits') {
                            showToast('Out of credits — running the simulation. Add credits for real runs.', '💰');
                            Account.openCredits();
                        } else if (data.reason === 'plan-upgrade') {
                            showToast('Real runs are a paid feature — showing the simulation.', '🔒');
                            Account.openPricing();
                        } else if (data.reason === 'plan-custom') {
                            showToast('Custom tasks need the Ultimate plan — showing the simulation.', '🔒');
                            Account.openPricing();
                        } else if (data.reason === 'plan-models') {
                            showToast(`Your plan runs up to ${data.max} models live — showing the simulation.`, '🔒');
                            Account.openPricing();
                        } else if (data.reason === 'plan-quota') {
                            showToast('You\'ve hit today\'s run limit for your plan.', '⏳');
                            Account.openPricing();
                        } else if (data.reason === 'daily-cap') {
                            showToast('Live runs paused for today (daily cap) — showing the simulation.', '⏳');
                        }
                    }
                } catch (e) { /* offline / disabled → simulate everything */ }
                const liveCount = Object.keys(liveById).length;
                if (runCharge) Account.applyBalance(runCharge.balance);

                // All agents "stream" concurrently (slightly staggered starts)
                // so a full 12-agent run finishes in seconds, not minutes.
                const results = [];
                await Promise.all(selected.map(async (agent, i) => {
                    const outputDiv = document.getElementById(`output-${agent.id}`);
                    if (!outputDiv) return;

                    await new Promise(r => setTimeout(r, i * 150));

                    const lv = liveById[agent.id];
                    const mockText = lv ? lv.output : getMockResponse(agent.id, task.id);
                    await typeWriter(outputDiv, mockText, lv ? 2 : 4);

                    // Deterministic per agent+task: reruns give the same scores.
                    const rand = seededRandom(`${agent.id}::${task.id}`);
                    // Real runs carry measured latency + token counts; simulated
                    // runs derive them from the model profile. Scores stay a
                    // simulated heuristic either way (see the demo notice).
                    const latency = lv ? Math.max(0.1, lv.latencyMs / 1000) : agent.latency * (0.85 + rand() * 0.3);
                    const tokens = lv ? ((lv.promptTokens || 0) + (lv.completionTokens || 0)) : Math.round(mockText.length / 4.5 + rand() * 20);
                    const cost = (agent.costPer1k * tokens) / 1000;

                    if (lv) {
                        const head = cards[agent.id]?.querySelector('.card-head .agent-info div:last-child');
                        if (head && !head.querySelector('.live-badge')) {
                            head.insertAdjacentHTML('beforeend', ' <span class="live-badge">● Live</span>');
                        }
                    }

                    const accuracy = Math.min(95, 65 + rand() * 30);
                    const relevance = Math.min(92, 60 + rand() * 32);
                    const speedScore = Math.max(40, Math.min(98, 100 - latency * 20));
                    const costScore = Math.max(30, Math.min(98, 100 - cost * 8000));

                    const totalScore = Math.round((accuracy * 0.35) + (relevance * 0.30) + (speedScore * 0.20) + (costScore *
                        0.15));

                    const scoreBadge = cards[agent.id]?.querySelector('.score-badge');
                    if (scoreBadge) scoreBadge.textContent = `${totalScore} pts`;

                    setText(`latency-${agent.id}`, latency.toFixed(1));
                    setText(`tokens-${agent.id}`, tokens);
                    setText(`cost-${agent.id}`, `$${cost.toFixed(4)}`);
                    setWidth(`acc-${agent.id}`, accuracy);
                    setWidth(`rel-${agent.id}`, relevance);
                    setWidth(`spd-${agent.id}`, speedScore);
                    setWidth(`costbar-${agent.id}`, costScore);

                    results.push({
                        agent: agent.id,
                        name: agent.name,
                        provider: agent.provider,
                        color: agent.color,
                        output: mockText,
                        live: !!lv,
                        latency,
                        tokens,
                        cost,
                        dimensions: { accuracy, relevance, speedScore, costScore },
                        totalScore
                    });
                }));

                state.results = results;
                renderScorecard(results);
                if (liveCount) {
                    const chargeNote = runCharge && runCharge.charged ? ` · charged ${Account.fmt(runCharge.charged)}` : '';
                    showToast(`⚡ ${liveCount} card${liveCount > 1 ? 's' : ''} ran on real models · the rest are simulated${chargeNote}`, '⚡');
                }
                state.isRunning = false;
                runBtn.disabled = false;
                runBtn.textContent = '🔄 Rerun';

            } catch (err) {
                showToast(`Error: ${err.message}`, '❌');
                console.error(err);
                state.isRunning = false;
                runBtn.disabled = false;
                runBtn.textContent = '🚀 Run Arena';
            }
        }

        function renderScorecard(results) {
            const sorted = [...results].sort((a, b) => b.totalScore - a.totalScore);
            scorecardGrid.innerHTML = sorted.map((r, i) => {
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`;
                const cls = i === 0 ? 'medal-gold' : i === 1 ? 'medal-silver' : i === 2 ? 'medal-bronze' : '';
                return `
                    <div class="scorecard-item">
                        <div class="rank ${cls}">${medal}</div>
                        <div class="sname">${escapeHtml(r.name)}</div>
                        <div class="selo">Sim. ELO ${Math.round(1200 + r.totalScore * 0.9)}</div>
                        <div class="sdim">${r.totalScore} pts · ${r.dimensions.accuracy.toFixed(0)}% Acc</div>
                    </div>
                `;
            }).join('');
        }

        // ----------------------------------------------------------------
        //  THEME
        // ----------------------------------------------------------------
        function toggleTheme() {
            const html = document.documentElement;
            const current = html.getAttribute('data-theme');
            const next = current === 'dark' ? 'light' : 'dark';
            html.setAttribute('data-theme', next);
            themeToggle.textContent = next === 'dark' ? '☀️' : '🌙';
            footerLabel.textContent = next === 'dark' ? 'Dark' : 'Light';
            try { localStorage.setItem('arena-theme', next); } catch (e) { /* ignore */ }
        }

        function loadTheme() {
            // The pre-paint script in <head> already set data-theme; just sync the UI.
            const current = document.documentElement.getAttribute('data-theme') || 'light';
            themeToggle.textContent = current === 'dark' ? '☀️' : '🌙';
            footerLabel.textContent = current === 'dark' ? 'Dark' : 'Light';
        }

        // ----------------------------------------------------------------
        //  ACCOUNT + CREDITS (SaaS)
        //  Reuses EchoDeck's accounts (email+password sessions). Simulated runs
        //  stay free; real runs require sign-in + a prepaid credits balance.
        // ----------------------------------------------------------------
        const Account = (function () {
            const KEY = 'arena-session';
            let token = null;
            let wallet = null;      // { credits, plan, ... } in cents
            let plans = [];         // [{ id, name, price, maxModels, tasks, ... }]
            let planId = 'free';    // the signed-in account's current plan
            let authMode = 'login'; // or 'signup'
            const fmt = (cents) => '$' + (Math.max(0, cents || 0) / 100).toFixed(2);
            // Free-plan fallback so gates work while logged out / before load.
            const FREE = { id: 'free', maxModels: 2, tasks: 'starter', features: { customTasks: false } };
            const currentPlan = () => plans.find(p => p.id === planId) || FREE;

            function headers(extra = {}) {
                return { 'Content-Type': 'application/json', ...(token ? { 'X-Session': token } : {}), ...extra };
            }

            function renderChip() {
                const signinBtn = $('signinBtn');
                const walletChip = $('walletChip');
                if (token && wallet) {
                    signinBtn.style.display = 'none';
                    walletChip.style.display = 'flex';
                    const planName = (currentPlan().name || 'Free');
                    $('balanceLabel').textContent = `${planName} · ${fmt(wallet.credits)}`;
                    $('adminLink').style.display = wallet.owner ? '' : 'none';
                } else {
                    signinBtn.style.display = '';
                    walletChip.style.display = 'none';
                }
            }

            // Re-render the parts of the arena whose limits depend on the plan.
            function applyGates() {
                renderChip();
                renderTasks();
                if (state.currentStep === 2) renderAgents();
            }

            async function loadPlans() {
                try {
                    const res = await fetch('/api/arena/plans');
                    if (res.ok) plans = await res.json();
                } catch (e) { /* offline — FREE fallback used */ }
            }

            async function refresh() {
                if (!token) { wallet = null; planId = 'free'; applyGates(); return; }
                try {
                    const res = await fetch('/api/arena/credits', { headers: headers() });
                    if (res.status === 401) { token = null; localStorage.removeItem(KEY); wallet = null; planId = 'free'; applyGates(); return; }
                    if (res.ok) { wallet = await res.json(); planId = wallet.plan || 'free'; applyGates(); }
                } catch (e) { /* offline */ }
            }

            function openPricing() {
                const cur = planId;
                $('planGrid').innerHTML = plans.map(p => {
                    const feats = [];
                    feats.push(`${p.maxModels || 2} models per run`);
                    feats.push(p.tasks === 'all' ? 'All 10 workflows' : '3 starter workflows');
                    if (p.features?.realRuns) feats.push('Real model runs');
                    if (p.features?.customTasks) feats.push('Custom tasks (your prompts)');
                    if (p.monthlyCredits) feats.push(`${fmt(p.monthlyCredits)}/mo run credits`);
                    const isCurrent = p.id === cur;
                    const featured = p.id === 'pro';
                    const btn = p.price === 0
                        ? `<button class="btn btn-outline" disabled>${isCurrent ? 'Current plan' : 'Free'}</button>`
                        : (isCurrent
                            ? `<button class="btn btn-outline" disabled>Current plan</button>`
                            : `<button class="btn btn-primary" data-plan="${p.id}">Upgrade to ${escapeHtml(p.name)}</button>`);
                    return `<div class="plan-card ${featured ? 'featured' : ''} ${isCurrent ? 'current' : ''}">
                        ${featured ? '<span class="plan-tag">Most popular</span>' : '<span class="plan-tag">&nbsp;</span>'}
                        <h4>${escapeHtml(p.name)}</h4>
                        <div class="price">${p.price === 0 ? 'Free' : '$' + p.price}${p.price ? '<small>/mo</small>' : ''}</div>
                        <ul>${feats.map(f => `<li>${escapeHtml(f)}</li>`).join('')}</ul>
                        ${btn}
                    </div>`;
                }).join('');
                $('planGrid').querySelectorAll('button[data-plan]').forEach(b => b.addEventListener('click', () => subscribe(b.dataset.plan)));
                overlay(true, 'pricing');
            }

            async function subscribe(plan) {
                if (!token) { openAuth('signup'); return; }
                const btns = $('planGrid').querySelectorAll('button');
                btns.forEach(b => b.disabled = true);
                try {
                    const res = await fetch('/api/arena/subscribe', { method: 'POST', headers: headers(), body: JSON.stringify({ plan }) });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) { showToast(data.error || 'Could not start upgrade.', '❌'); return; }
                    if (data.url && !data.dev) { window.location.href = data.url; return; } // Stripe redirect
                    await refresh();          // dev-mode instant upgrade
                    overlay(false);
                    showToast(`You're on ${currentPlan().name || plan}! 🎉`, '✅');
                } catch (err) {
                    showToast('Upgrade failed — please try again.', '❌');
                } finally {
                    btns.forEach(b => b.disabled = false);
                }
            }

            function overlay(show, which) {
                const ov = $('modalOverlay');
                $('authModal').style.display = which === 'auth' ? 'block' : 'none';
                $('creditsModal').style.display = which === 'credits' ? 'block' : 'none';
                $('pricingModal').style.display = which === 'pricing' ? 'block' : 'none';
                ov.classList.toggle('show', show);
            }

            function openAuth(mode = 'login') {
                authMode = mode;
                $('authTitle').textContent = mode === 'signup' ? 'Create account' : 'Sign in';
                $('authSubmit').textContent = mode === 'signup' ? 'Create account' : 'Sign in';
                $('authToggleText').textContent = mode === 'signup' ? 'Already have an account?' : 'New here?';
                $('authToggle').textContent = mode === 'signup' ? 'Sign in' : 'Create an account';
                $('authErr').textContent = '';
                overlay(true, 'auth');
                setTimeout(() => $('authEmail').focus(), 50);
            }

            function openCredits() {
                if (!token) { openAuth('signup'); return; }
                $('creditsBalance').textContent = fmt(wallet?.credits || 0);
                const note = wallet?.stripe
                    ? 'Secure payment via Stripe. Credits are added when payment completes.'
                    : 'Demo mode: credits are added instantly (no real charge) until Stripe is configured.';
                $('creditsNote').textContent = note;
                const row = $('packRow');
                row.innerHTML = (wallet?.packs || []).map(p => `<button class="pack-btn" data-pack="${p.id}">${p.label}</button>`).join('');
                row.querySelectorAll('.pack-btn').forEach(btn => btn.addEventListener('click', () => topup(btn.dataset.pack)));
                overlay(true, 'credits');
            }

            async function submitAuth(e) {
                e.preventDefault();
                const email = $('authEmail').value.trim();
                const password = $('authPassword').value;
                const path = authMode === 'signup' ? '/api/auth/signup' : '/api/auth/login';
                $('authErr').textContent = '';
                $('authSubmit').disabled = true;
                try {
                    const res = await fetch(path, { method: 'POST', headers: headers(), body: JSON.stringify({ email, password }) });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) { $('authErr').textContent = data.error || 'Something went wrong.'; return; }
                    token = data.token;
                    try { localStorage.setItem(KEY, token); } catch (e2) { /* ignore */ }
                    overlay(false);
                    await refresh();
                    showToast(authMode === 'signup' ? 'Account created — welcome!' : 'Signed in.', '✅');
                } catch (err) {
                    $('authErr').textContent = 'Network error — please try again.';
                } finally {
                    $('authSubmit').disabled = false;
                }
            }

            async function topup(packId) {
                const row = $('packRow');
                row.querySelectorAll('.pack-btn').forEach(b => b.disabled = true);
                try {
                    const res = await fetch('/api/arena/credits/topup', { method: 'POST', headers: headers(), body: JSON.stringify({ pack: packId }) });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) { showToast(data.error || 'Top-up failed.', '❌'); return; }
                    if (data.url && !data.dev) { window.location.href = data.url; return; } // Stripe redirect
                    await refresh();                 // dev-mode instant credit
                    openCredits();
                    showToast(`Added credits — balance ${fmt(wallet?.credits || 0)}`, '💰');
                } catch (err) {
                    showToast('Top-up failed — please try again.', '❌');
                } finally {
                    row.querySelectorAll('.pack-btn').forEach(b => b.disabled = false);
                }
            }

            async function signout() {
                try { await fetch('/api/auth/logout', { method: 'POST', headers: headers() }); } catch (e) { /* ignore */ }
                token = null; wallet = null;
                try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
                renderChip();
                showToast('Signed out.', '↩');
            }

            async function init() {
                try { token = localStorage.getItem(KEY); } catch (e) { token = null; }
                $('signinBtn').addEventListener('click', () => openAuth('login'));
                $('creditsBtn').addEventListener('click', openCredits);
                $('signoutBtn').addEventListener('click', signout);
                $('authForm').addEventListener('submit', submitAuth);
                $('authToggle').addEventListener('click', (e) => { e.preventDefault(); openAuth(authMode === 'signup' ? 'login' : 'signup'); });
                $('pricingLink').addEventListener('click', (e) => { e.preventDefault(); openPricing(); });
                $('modalOverlay').addEventListener('click', (e) => { if (e.target === $('modalOverlay')) overlay(false); });
                document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => overlay(false)));
                document.addEventListener('keydown', (e) => { if (e.key === 'Escape') overlay(false); });
                await loadPlans();
                renderChip();
                await refresh();
                applyGates();
                // Returning from a Stripe top-up or upgrade → refresh + clean the URL.
                if (/[?&](topup|upgrade)=success/.test(location.search)) {
                    showToast('Payment complete — you\'re all set.', '✅');
                    history.replaceState(null, '', location.pathname);
                }
            }

            return {
                init, openAuth, openCredits, openPricing,
                token: () => token,
                fmt,
                maxModels: () => currentPlan().maxModels || 2,
                taskLimit: () => (currentPlan().tasks === 'all' ? state.tasks.length : 3),
                customTasksAllowed: () => Boolean(currentPlan().features && currentPlan().features.customTasks),
                applyBalance(cents) { if (wallet) { wallet.credits = cents; renderChip(); } },
            };
        })();

        // ----------------------------------------------------------------
        //  EVENTS
        // ----------------------------------------------------------------
        document.addEventListener('DOMContentLoaded', () => {
            Account.init();
            renderTasks();
            renderAgents();
            updateStep(1);
            loadTheme();
            taskCountSpan.textContent = state.tasks.length;
            $('footerYear').textContent = new Date().getFullYear();

            // Load the live model registry, then poll it so newly released
            // models are auto-added to the agent list without a page reload.
            knownModelIds = currentModelIdSet();
            refreshModels({ silent: true });
            setInterval(() => refreshModels(), MODELS_POLL_MS);

            document.querySelectorAll('.step-dot').forEach(dot => {
                keyActivate(dot);
                dot.addEventListener('click', () => {
                    const targetStep = parseInt(dot.dataset.step);
                    if (targetStep > state.currentStep + 1) { showToast('Please complete the current step first.', '⚠️');
                        return; }
                    if (targetStep === 2 && !state.selectedTask) { showToast('Please select a task first.', '⚠️');
                        return; }
                    if (targetStep === 3 && state.selectedAgents.length < 2) { showToast('Please select at least 2 agents.', '⚠️');
                        return; }
                    updateStep(targetStep);
                });
            });

            $('selectAllAgents').addEventListener('click', () => {
                state.selectedAgents = state.agents.map(a => a.id);
                renderAgents();
                updateRunSummary();
            });
            $('clearAllAgents').addEventListener('click', () => {
                state.selectedAgents = [];
                renderAgents();
                updateRunSummary();
            });

            backBtn.addEventListener('click', () => {
                if (state.currentStep === 3) updateStep(2);
                else if (state.currentStep === 2) updateStep(1);
            });
            $('backFromAgentsBtn').addEventListener('click', () => updateStep(1));

            $('nextToRunBtn').addEventListener('click', () => {
                if (state.selectedAgents.length < 2) { showToast('Please select at least 2 agents to duel.', '⚠️');
                    return; }
                updateStep(3);
            });

            runBtn.addEventListener('click', runArena);

            $('exportBtn').addEventListener('click', () => {
                if (!state.results.length) return;
                const data = state.results.map(r => ({
                    agent: r.name,
                    provider: r.provider,
                    score: r.totalScore,
                    dimensions: r.dimensions,
                    latency: r.latency,
                    cost: r.cost,
                    output: r.output
                }));
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `arena-scorecard-${new Date().toISOString().slice(0,10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
            });

            $('publishBtn').addEventListener('click', publishScorecard);
            $('copyLinkBtn').addEventListener('click', () => {
                const url = publishLink.href;
                if (!url || url.endsWith('#')) return;
                navigator.clipboard?.writeText(url).then(
                    () => showToast('Link copied to clipboard.', '📋'),
                    () => showToast('Copy failed — select the link manually.', '⚠️')
                );
            });

            $('resetBtn').addEventListener('click', () => {
                state.results = [];
                resultsDiv.style.display = 'none';
                comparisonGrid.innerHTML = '';
                scorecardGrid.innerHTML = '';
                publishBar.style.display = 'none';
                runBtn.textContent = '🚀 Run Arena';
                updateStep(1);
            });

            themeToggle.addEventListener('click', toggleTheme);

            // ** Sync button **
            syncBtn.addEventListener('click', () => refreshModels({ manual: true }));

            updateRunSummary();
            loadCommunity();
        });

        // ----------------------------------------------------------------
        //  PUBLISH + COMMUNITY SCORECARDS
        // ----------------------------------------------------------------
        async function publishScorecard() {
            if (!state.results.length) { showToast('Run a benchmark first.', '⚠️'); return; }
            const btn = $('publishBtn');
            btn.disabled = true;
            btn.textContent = '⏳ Publishing...';
            try {
                const payload = {
                    task: state.selectedTask?.title || 'Untitled task',
                    taskEmoji: state.selectedTask?.emoji || '⚡',
                    results: state.results.map(r => ({
                        name: r.name, provider: r.provider, color: r.color,
                        totalScore: r.totalScore, dimensions: r.dimensions,
                        latency: r.latency, cost: r.cost, output: r.output, live: r.live,
                    })),
                };
                const res = await fetch('/api/arena/scorecards', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
                const { id } = await res.json();
                const url = `${location.origin}/arena/s/${id}`;
                publishLink.href = url;
                publishLink.textContent = url;
                publishBar.style.display = 'flex';
                showToast('Scorecard published! Share the link.', '📢');
                loadCommunity();
            } catch (err) {
                showToast(`Publish failed: ${err.message}`, '❌');
            } finally {
                btn.disabled = false;
                btn.textContent = '📢 Publish';
            }
        }

        async function loadCommunity() {
            try {
                const res = await fetch('/api/arena/scorecards?limit=8');
                if (!res.ok) return;
                const cards = await res.json();
                if (!cards.length) { communityPanel.style.display = 'none'; return; }
                communityGrid.innerHTML = cards.map(c => `
                    <a class="community-card" href="/arena/s/${encodeURIComponent(c.id)}">
                        <div class="cc-task">${escapeHtml(c.taskEmoji || '⚡')} ${escapeHtml(c.task || 'Task')}</div>
                        <div class="cc-meta"><span class="cc-winner">🥇 ${escapeHtml(c.winner || '—')}</span> · ${c.winnerScore || 0} pts · ${c.agentCount || 0} agents</div>
                        <div class="cc-date">${timeAgo(c.createdAt)}</div>
                    </a>
                `).join('');
                communityPanel.style.display = 'block';
            } catch (e) { /* offline / no backend — silently skip */ }
        }

