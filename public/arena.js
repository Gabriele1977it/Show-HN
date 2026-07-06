        // ----------------------------------------------------------------
        //  MODEL REGISTRY — a static demo snapshot (early 2026).
        //  Costs and latencies are illustrative, not live pricing.
        // ----------------------------------------------------------------
        const PROVIDER_DATA = {
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
                    { id: 'hermes-4', name: 'Hermes 4', costPer1k: 0.001, latency: 0.8, trend: '🔥 Trending' },
                    { id: 'openhermes', name: 'OpenHermes', costPer1k: 0.0006, latency: 0.9 },
                    { id: 'dolphin-3', name: 'Dolphin 3.0', costPer1k: 0.0005, latency: 1.0 }
                ]
            }
        };

        // ----------------------------------------------------------------
        //  AUTO-UPDATE ENGINE (simulates fetching newly released models —
        //  entries below are fictional previews, not real announcements)
        // ----------------------------------------------------------------
        const PENDING_MODELS_POOL = {
            'OpenAI': [{ id: 'gpt-6-preview', name: 'GPT-6 (Preview)', costPer1k: 0.025, latency: 2.5, trend: '🚀 Preview' }],
            'Anthropic': [{ id: 'claude-next-preview', name: 'Claude Next (Preview)', costPer1k: 0.03, latency: 2.0, trend: '🚀 Preview' }],
            'Google': [{ id: 'gemini-4-preview', name: 'Gemini 4 (Preview)', costPer1k: 0.018, latency: 1.9, trend: '🚀 Preview' }],
            'Meta': [{ id: 'llama-5-preview', name: 'Llama 5 (Preview)', costPer1k: 0.002, latency: 1.4, trend: '🚀 Preview' }],
            'xAI': [{ id: 'grok-5-preview', name: 'Grok 5 (Preview)', costPer1k: 0.02, latency: 1.5, trend: '🚀 Preview' }],
            'DeepSeek': [{ id: 'deepseek-r2-preview', name: 'DeepSeek-R2 (Preview)', costPer1k: 0.003, latency: 1.6, trend: '🚀 Preview' }],
            'Community': [{ id: 'hermes-5-preview', name: 'Hermes 5 (Preview)', costPer1k: 0.003, latency: 0.6, trend: '🚀 Preview' }]
        };

        let versionCounter = 1;
        let lastSyncTime = null;

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
                'content-brief': `# Content Brief: Choosing the Right AI Agent\n\n## Audience\nSMB founders, non-technical.\n\n## Key Message\nYou don't need a PhD to use AI.\n\n## Outline\n1. Introduction\n2. What is an AI agent?\n3. 3 types of agents\n4. 5 questions to ask\n5. Real examples\n6. How to test in 10 minutes\n7. Pitfalls to avoid\n8. Conclusion\n\n## CTA\n"Grab a free 15-min consultation."`
            },
            'Anthropic': {
                'sales-email': `Subject: Your logistics savings opportunity\n\nHi Alex,\n\nThanks for checking out our pricing guide. I understand you're evaluating ways to reduce costs.\n\nWith your logistics volume, we typically see 20% savings in the first quarter. No carrier changes required—we optimize what you already have.\n\nIf you have 15 minutes this week, I'd love to share how we did this for a similar-sized firm.\n\nCheers,\n[Your Name]`,
                'lead-qualify': `1. Lead Score: 92/100\n2. Priority: High\n3. Recommended next step: Immediate demo with technical SME. Include ROI calculator.\n4. Reasoning: Near-perfect fit: budget, authority, need, and timeline are all aligned.`,
                'support-triage': `1. Category: Bug (UI/Export)\n2. Priority: P0\n3. Suggested Team: Engineering with Support escalation\n4. Response: "I understand the urgency. We're on it. I'll have our team export the data directly. We'll email it within 20 minutes."`,
                'content-brief': `# Content Brief: Picking the Right AI Agent\n\n## Audience\nBusy founders.\n\n## Core Message\nAI agents are tools, not magic.\n\n## Outline\n1. The 2026 AI landscape\n2. Chat vs. workflow vs. custom\n3. The 5-minute test\n4. Red flags\n5. Our top 3 picks\n6. How to run a pilot\n\n## CTA\n"Book a free 15-min AI assessment."`
            },
            'Google': {
                'sales-email': `Subject: Making the most of your pricing guide\n\nHi Alex,\n\nI saw you grabbed our pricing guide—great choice.\n\nI'm curious: what's the biggest logistics challenge you're facing right now? We've helped ops leaders cut costs by 20% without compromising service.\n\nUp for a quick 15-minute chat this week?\n\nBest,\n[Your Name]`,
                'lead-qualify': `1. Lead Score: 78/100\n2. Priority: Medium-High\n3. Recommended next step: Send a case study and follow up in 1 week.\n4. Reasoning: Good fit and clear need, but the timeline is longer. Nurture with targeted content.`,
                'support-triage': `1. Category: Bug (Data Export)\n2. Priority: P1\n3. Suggested Team: Support + Engineering\n4. Response: "We're on this. We can email you the CSV manually in 30 minutes."`,
                'content-brief': `# Content Brief: AI Agents for SMBs\n\n## Audience\nSmall business owners.\n\n## Message\nAI agents are like smart interns.\n\n## Outline\n1. What is an AI agent?\n2. Why SMBs need them\n3. 3 biggest mistakes\n4. How to test in 10 minutes\n5. Recommendations\n6. Getting started on a budget\n\n## CTA\n"Try our free AI agent selector."`
            },
            'Meta': {
                'sales-email': `Subject: Re: Pricing guide download\n\nHi Alex,\n\nI'm following up on your download of our pricing guide.\n\nWe help logistics companies save 20% on freight costs. I'd love to share some specific examples.\n\nAre you free for a 15-min call this week?\n\nBest,\n[Your Name]`,
                'lead-qualify': `1. Lead Score: 72/100\n2. Priority: Medium\n3. Recommended next step: Send a case study and follow up in 2 weeks.\n4. Reasoning: Good fit but timeline is less urgent. Needs more nurturing.`,
                'support-triage': `1. Category: Bug (Export)\n2. Priority: P1\n3. Suggested Team: Support\n4. Response: "We're fixing the export issue now. I'll manually send you the CSV. Apologies."`,
                'content-brief': `# Content Brief: AI Agents for SMBs\n\n## Audience\nSMB owners.\n\n## Message\nAI agents can save you time.\n\n## Outline\n1. What is an AI agent?\n2. Use cases\n3. How to choose\n4. Next steps\n\n## CTA\n"Book a consultation."`
            },
            'xAI': {
                'sales-email': `Subject: Logistics optimization\n\nHi Alex,\n\nThanks for downloading our guide. Grok here.\n\nWe've analyzed thousands of logistics operations and found that AI-driven optimization cuts costs by 20% on average. No carrier changes, just smarter routing.\n\nGot 15 minutes to see how we do it?\n\nCheers,\n[Your Name]`,
                'lead-qualify': `1. Lead Score: 88/100\n2. Priority: High\n3. Next step: Run a quick simulation for them.\n4. Reasoning: Strong intent, good budget.`,
                'support-triage': `1. Category: Bug\n2. Priority: P0\n3. Team: Engineering\n4. Response: "We're on it. Will have the export fixed shortly."`,
                'content-brief': `# Content Brief: AI for SMBs\n\n## Audience\nFounders.\n\n## Outline\n1. The AI revolution\n2. Top agents\n3. How to pick\n\n## CTA\n"Get started."`
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
                'content-brief': `# The SMB Guide to AI Agents\n\n## Audience\nNon-technical founders.\n\n## Message\nAI agents are the best new hires you'll ever make.\n\n## Outline\n1. AI agents: The new assistant\n2. 5 tasks to hand off\n3. How to pick the right agent\n4. Our top picks\n5. 3 free tools to start\n\n## CTA\n"Get your free AI task assessment."`
            }
        };

        const DEFAULT_MOCK = {
            'sales-email': `Subject: Quick question\n\nHi Alex,\n\nJust following up on your interest in our pricing guide. Would love to chat.\n\nBest,\n[Your Name]`,
            'lead-qualify': `1. Score: 75/100\n2. Priority: Medium\n3. Next: Follow up.`,
            'support-triage': `1. Bug\n2. P1\n3. Support\n4. "We'll look into it."`,
            'content-brief': `# Content Brief\n\n## Outline\n1. Intro\n2. Use cases\n\n## CTA\n"Learn more."`
        };

        function getMockResponse(agentId, taskId) {
            const agent = state.agents.find(a => a.id === agentId);
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

        let toastTimeout = null;
        let runCount = 0;

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
            taskGrid.innerHTML = state.tasks.map(task => `
                <div class="task-card ${state.selectedTask?.id === task.id ? 'active' : ''}" data-id="${escapeHtml(task.id)}" aria-pressed="${state.selectedTask?.id === task.id}">
                    <span class="emoji">${task.emoji}</span>
                    <div class="info">
                        <strong>${escapeHtml(task.title)}</strong>
                        <p>${escapeHtml(task.desc)}</p>
                        <div class="task-meta">${escapeHtml(task.difficulty)} · ${task.prompt.length} chars</div>
                    </div>
                </div>
            `).join('');

            taskGrid.querySelectorAll('.task-card').forEach(el => {
                keyActivate(el);
                el.addEventListener('click', () => {
                    const id = el.dataset.id;
                    state.selectedTask = state.tasks.find(t => t.id === id);
                    renderTasks();
                    updateStep(2);
                });
            });
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
                if (state.selectedAgents.length < 12) {
                    state.selectedAgents.push(id);
                } else {
                    showToast('Maximum 12 agents per run.', '⚠️');
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
        function syncModels() {
            syncBtn.disabled = true;
            syncBtn.textContent = '⏳ Syncing...';
            syncStatus.textContent = 'Checking registry...';

            // Simulate network delay
            setTimeout(() => {
                try {
                    let addedCount = 0;
                    const providers = Object.keys(PENDING_MODELS_POOL);
                    // Pick 3-5 random providers to "release" new models
                    const shuffled = providers.sort(() => 0.5 - Math.random());
                    const numToAdd = Math.min(4 + Math.floor(Math.random() * 2), shuffled.length);

                    for (let i = 0; i < numToAdd; i++) {
                        const provider = shuffled[i];
                        const pool = PENDING_MODELS_POOL[provider];
                        if (pool && pool.length > 0) {
                            const newModel = pool.shift(); // take one
                            // Add to PROVIDER_DATA
                            if (PROVIDER_DATA[provider]) {
                                PROVIDER_DATA[provider].models.push(newModel);
                                addedCount++;
                            }
                        }
                    }

                    // Rebuild state.agents
                    state.agents = buildFlatAgents();
                    versionCounter++;
                    lastSyncTime = Date.now();

                    // Re-render
                    renderAgents();
                    updateRunSummary();
                    syncStatus.textContent = `✅ Synced (${addedCount} new)`;
                    showToast(`Added ${addedCount} new models from the registry!`, '📦');

                    // If no models left in pool, disable
                    let remaining = 0;
                    Object.keys(PENDING_MODELS_POOL).forEach(p => remaining += PENDING_MODELS_POOL[p].length);
                    if (remaining === 0) {
                        syncStatus.textContent = '✅ All models synced!';
                        syncBtn.textContent = '✅ Up to Date';
                        syncBtn.disabled = true;
                    } else {
                        syncBtn.textContent = '🔄 Sync Models';
                        syncBtn.disabled = false;
                    }

                } catch (e) {
                    showToast('Sync failed. Please refresh and try again.', '❌');
                    console.error(e);
                    syncBtn.textContent = '🔄 Sync Models';
                    syncBtn.disabled = false;
                    syncStatus.textContent = '❌ Error';
                }
            }, 1400 + Math.random() * 800);
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

                // All agents "stream" concurrently (slightly staggered starts)
                // so a full 12-agent run finishes in seconds, not minutes.
                const results = [];
                await Promise.all(selected.map(async (agent, i) => {
                    const outputDiv = document.getElementById(`output-${agent.id}`);
                    if (!outputDiv) return;

                    await new Promise(r => setTimeout(r, i * 150));

                    const mockText = getMockResponse(agent.id, task.id);
                    await typeWriter(outputDiv, mockText, 4);

                    // Deterministic per agent+task: reruns give the same scores.
                    const rand = seededRandom(`${agent.id}::${task.id}`);
                    const latency = agent.latency * (0.85 + rand() * 0.3);
                    const tokens = Math.round(mockText.length / 4.5 + rand() * 20);
                    const cost = (agent.costPer1k * tokens) / 1000;

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
                        latency,
                        tokens,
                        cost,
                        dimensions: { accuracy, relevance, speedScore, costScore },
                        totalScore
                    });
                }));

                state.results = results;
                renderScorecard(results);
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
        //  EVENTS
        // ----------------------------------------------------------------
        document.addEventListener('DOMContentLoaded', () => {
            renderTasks();
            renderAgents();
            updateStep(1);
            loadTheme();
            taskCountSpan.textContent = state.tasks.length;
            $('footerYear').textContent = new Date().getFullYear();

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

            $('publishBtn').addEventListener('click', () => {
                showToast('Demo only — there is no community leaderboard (yet). Use Export instead.', '📢');
            });

            $('resetBtn').addEventListener('click', () => {
                state.results = [];
                resultsDiv.style.display = 'none';
                comparisonGrid.innerHTML = '';
                scorecardGrid.innerHTML = '';
                runBtn.textContent = '🚀 Run Arena';
                updateStep(1);
            });

            themeToggle.addEventListener('click', toggleTheme);

            // ** Sync button **
            syncBtn.addEventListener('click', syncModels);

            updateRunSummary();
        });

