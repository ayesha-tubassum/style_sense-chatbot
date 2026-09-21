/* ==========================================================================
   StyleSense AI — Chatbot
   --------------------------------------------------------------------------
   Two engines behind one premium chat UI:

   1. HOSTED ENGINE  — calls an OpenAI-compatible /chat/completions endpoint
                       (Hugging Face Inference API, OpenAI, Groq, Ollama, or
                        the bundled local proxy) using the exact StyleSense
                        system prompt from js/config.js.

   2. STYLIST ENGINE — a fully offline, deterministic fashion-advice engine.
                       It understands occasion, season, climate, dress code,
                       colour, fabric, body-shape and budget keywords and
                       produces a structured, stylist-style answer. This makes
                       the chatbot work with ZERO setup and ZERO API keys, and
                       it is the automatic fallback if the hosted call fails.

   Public API: window.StyleSense.chat(message)  and  window.StyleSense.reset()
   ========================================================================== */

(function () {
  "use strict";

  const CFG = window.STYLESENSE_CONFIG || {};
  const BRAND = CFG.brand || {};
  const API = CFG.api || {};
  const UI = CFG.ui || {};

  /* ======================================================================
     1. TINY HELPERS
  ====================================================================== */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* Escape HTML so nothing user-supplied can inject markup.
     Entities are built with hex escapes so that editor / HTML
     auto-formatters cannot decode them back into raw characters. */
  const HTML_ENTITIES = {
    "&": "\x26amp;",
    "<": "\x26lt;",
    ">": "\x26gt;",
    '"': "\x26quot;",
    "'": "\x26#39;"
  };
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (ch) => HTML_ENTITIES[ch]);
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /** Pick n unique items from an array. */
  function sample(arr, n) {
    const copy = arr.slice();
    const out = [];
    while (out.length < n && copy.length) {
      out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
    }
    return out;
  }

  /* ======================================================================
     2. MARKDOWN-LITE RENDERER
     Supports **bold**, *italic*, `code`, ### headings, bullet & numbered
     lists, horizontal rules and paragraphs. Input is escaped first.
  ====================================================================== */
  function renderMarkdown(src) {
    const lines = escapeHtml(String(src).replace(/\r\n/g, "\n")).split("\n");
    let html = "";
    let listType = null;

    const closeList = () => {
      if (listType) {
        html += listType === "ul" ? "</ul>" : "</ol>";
        listType = null;
      }
    };

    const inline = (text) =>
      text
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");

    for (const raw of lines) {
      const trimmed = raw.trim();

      if (!trimmed) { closeList(); continue; }

      if (/^(---|___|\*\*\*)$/.test(trimmed)) { closeList(); html += "<hr>"; continue; }

      const hMatch = trimmed.match(/^(#{3,4})\s+(.*)$/);
      if (hMatch) { closeList(); html += "<h4>" + inline(hMatch[2]) + "</h4>"; continue; }

      const bMatch = trimmed.match(/^[-*•]\s+(.*)$/);
      if (bMatch) {
        if (listType !== "ul") { closeList(); html += "<ul>"; listType = "ul"; }
        html += "<li>" + inline(bMatch[1]) + "</li>";
        continue;
      }

      const nMatch = trimmed.match(/^\d+[.)]\s+(.*)$/);
      if (nMatch) {
        if (listType !== "ol") { closeList(); html += "<ol>"; listType = "ol"; }
        html += "<li>" + inline(nMatch[1]) + "</li>";
        continue;
      }

      const qMatch = trimmed.match(/^>\s?(.*)$/);
      if (qMatch) {
        closeList();
        html += "<p><em>" + inline(qMatch[1]) + "</em></p>";
        continue;
      }

      closeList();
      html += "<p>" + inline(trimmed) + "</p>";
    }
    closeList();
    return html || "<p></p>";
  }

  /* ======================================================================
     3. KNOWLEDGE BASE — OFFLINE STYLIST ENGINE
  ====================================================================== */

  /* --- Occasion blueprints ------------------------------------------- */
  const OCCASIONS = [
    {
      id: "uni",
      label: "University / campus",
      keywords: ["university", "uni", "campus", "college", "lecture", "class", "school", "student", "semester", "study", "tutorial", "fresher"],
      intro: "Campus days need outfits comfortable enough to sit through three lectures in, but still put-together.",
      base: [
        "A clean fitted tee or ribbed knit in a neutral base (white, ecru, soft grey)",
        "Straight-leg or wide-leg trousers — denim, chino or a crepe pull-on style",
        "Layer with an oversized shirt or a cropped cardigan you can remove indoors"
      ],
      outer: [
        "A structured overshirt, denim jacket or light bomber for chilly mornings",
        "In winter swap to a wool-blend coat in camel, charcoal or navy"
      ],
      shoes: [
        "White leather sneakers — the single most versatile campus shoe",
        "Chunky loafers if you want to look a little more polished"
      ],
      acc: [
        "A canvas tote or compact backpack that fits a laptop",
        "Gold-tone hoops, a simple watch and one ring",
        "Sunglasses in a warm tortoiseshell"
      ],
      palette: "Neutral base + one accent. Cream, oatmeal and denim blue with a rust or olive accent reads effortless and never clashes in a lecture hall.",
      fabrics: "Cotton jersey and denim breathe through long days; a cotton–viscose blend drapes better than stiff polyester and resists creasing in a backpack.",
      tip: "Keep a thin neutral cardigan in your bag — lecture halls are either freezing or stuffy, and a layer instantly rescues an outfit.",
      alt: "If you'd rather keep it more relaxed, swap the trousers for well-fitted straight-leg jeans and add a plain hoodie in the same colour family."
    },
    {
      id: "interview",
      label: "Job interview",
      keywords: ["interview", "hr", "recruiter", "hiring", "job", "corporate", "office", "professional", "work", "workplace", "business", "meeting", "presentation", "internship"],
      intro: "For an interview the goal is simple: you want them to remember your face, not your outfit — quietly confident and nothing distracting.",
      base: [
        "A tailored blazer in navy, charcoal or deep grey — the single biggest upgrade",
        "A crisp collared shirt or fine-gauge knit in white, ivory or pale blue",
        "Straight or slightly tapered trousers with a clean break over the shoe"
      ],
      outer: [
        "Keep outerwear minimal — a wool overcoat or trench in a matching neutral",
        "Skip anything with logos, heavy hardware or loud patterns"
      ],
      shoes: [
        "Leather Oxfords, Derbies or a low block heel in black or dark brown",
        "Make sure they are polished; scuffed shoes undo a great suit"
      ],
      acc: [
        "A leather belt that matches your shoes almost exactly",
        "A slim briefcase or structured tote in black, tan or navy",
        "Minimal jewellery — a watch and small studs, nothing jangling"
      ],
      palette: "Navy or charcoal + white + one restrained accent (burgundy, forest green, slate blue). Avoid pure black-on-black if the culture is conservative — it can read as severe.",
      fabrics: "Wool or wool-blend suiting holds its shape and resists wrinkles through a long day. A cotton shirt with a touch of elastane keeps the collar crisp without stiffness.",
      tip: "Iron or steam everything the night before and hang it — visible creases are what interviewers actually notice.",
      alt: "If the company is clearly casual (a startup or creative studio), keep the blazer but pair it with dark clean denim and a fine knit instead of a shirt and tie."
    },
    {
      id: "formal",
      label: "Formal / black tie",
      keywords: ["formal", "black tie", "gala", "evening", "cocktail", "prom", "ball", "awards", "dinner", "opera", "ceremony", "graduation", "convocation", "banquet"],
      intro: "Formal dressing is about silhouette and finish — the fabric should look expensive and the fit should be exact.",
      base: [
        "A floor-length or midi dress in a rich fabric — satin, crepe or silk",
        "Or a sharply tailored tuxedo / dark suit with a proper lapel"
      ],
      outer: [
        "A tailored wrap, velvet blazer or embroidered shawl — outerwear is part of the look here",
        "For black tie, a dark overcoat so nothing competes with the outfit indoors"
      ],
      shoes: [
        "Satin or leather heels in nude, black or metallic",
        "Patent or highly polished leather shoes with dark socks matching the trousers"
      ],
      acc: [
        "One statement piece only — a bold earring, a cuff, or a metallic clutch",
        "A fine chain or slim bow tie; resist stacking everything at once"
      ],
      palette: "Deep jewel tones (emerald, sapphire, burgundy) photograph beautifully under warm event lighting. Metallics work as accents, never as the whole outfit.",
      fabrics: "Satin and silk catch light and read as luxury. Velvet is superb for cold-weather events. Avoid shiny synthetics in photographs — they reflect flash badly.",
      tip: "Match your clutch and shoes to the metal of your jewellery — gold with gold, silver with silver. It instantly looks deliberate.",
      alt: "If you'd rather keep it more relaxed, a well-cut midi dress with a structured blazer and elegant flats reads 'modern formal' without the full gown."
    },
    {
      id: "wedding",
      label: "Wedding",
      keywords: ["wedding", "bride", "groom", "bridal", "bridegroom", "nikah", "engagement", "reception", "mehndi", "sangeet", "marriage", "married", "in-law"],
      intro: "Wedding dressing balances celebration and respect — you want to feel special without ever competing with the couple.",
      base: [
        "Guests: a midi or maxi dress, or a tailored suit in a light or jewel tone",
        "Bridal party: co-ordinated fabrics and colours agreed with the couple",
        "Never wear white or ivory as a guest unless the invitation says otherwise"
      ],
      outer: [
        "A pashmina, embroidered shawl or light blazer that matches the palette",
        "For an evening ceremony, a richer fabric adds warmth and drama"
      ],
      shoes: [
        "Block heels are the practical hero — ceremonies mean grass, gravel or long standing",
        "Keep a spare pair of flats in the car for the dancing"
      ],
      acc: [
        "A small structured clutch, delicate jewellery and a light fragrance",
        "A fascinator, hair accessory or pocket square to tie into the palette"
      ],
      palette: "Soft pastels, jewel tones or the couple's stated theme. If no theme is given, dusty rose, sage, navy and champagne are always safe.",
      fabrics: "Chiffon, satin, georgette and silk move beautifully and photograph well. Brocade and embroidered fabrics are ideal for cultural ceremonies.",
      tip: "Check the invitation for a dress code line first — 'garden party', 'black tie' and 'traditional' each change the outfit completely.",
      alt: "If you'd rather keep it more relaxed, a tailored jumpsuit in a jewel tone with statement earrings is modern, comfortable and completely wedding-appropriate."
    },
    {
      id: "modest",
      label: "Modest fashion",
      keywords: ["modest", "hijab", "abaya", "kaftan", "niqab", "burqa", "conservative", "covered", "long skirt", "shalwar", "kameez", "saree", "dupatta", "islamic", "muslim", "cultural", "traditional"],
      intro: "Modest dressing is a design opportunity, not a restriction — layering, drape and fabric choice do all the work.",
      base: [
        "A long-sleeve top or tunic with a relaxed but shaped silhouette",
        "Wide-leg trousers, a maxi skirt or an A-line dress with good drape",
        "An abaya or kaftan in a fluid fabric is a complete outfit on its own"
      ],
      outer: [
        "An open long cardigan, duster coat or kimono-style layer adds movement",
        "Choose lighter layers for humidity and heavier weaves for cool weather"
      ],
      shoes: [
        "Block heels, loafers, clean sneakers or embellished flats",
        "Pointed flats in nude or metallic elongate the leg beautifully"
      ],
      acc: [
        "A hijab in a complementary tone — chiffon for drape, jersey for hold",
        "A structured tote, delicate jewellery, and a belt to define the waist"
      ],
      palette: "Tonal, layered dressing looks the most expensive: build in one family (all warm neutrals, or all cool blues) and add a single metallic accent.",
      fabrics: "Chiffon and crepe for drape and coverage without bulk; jersey for everyday comfort; linen-blend for heat. Avoid stiff fabrics that add unwanted volume.",
      tip: "Pin the hijab to the undertone of your outfit rather than exactly matching the colour — a near-match reads more stylish than a perfect one.",
      alt: "If you'd rather keep it more relaxed, a monochrome long-sleeve knit with wide-leg trousers and a longline open cardigan is effortless and elegant."
    },
    {
      id: "casual",
      label: "Everyday casual",
      keywords: ["casual", "everyday", "daily", "weekend", "hangout", "coffee", "errands", "shopping", "mall", "brunch", "movie", "friends", "trip", "walk"],
      intro: "Great casual style is built on fit, not logos — three well-fitting basics will always beat one loud statement piece.",
      base: [
        "A quality plain tee or relaxed button-up in a neutral",
        "Straight or slim denim, or wide-leg chinos for a softer look",
        "An open overshirt or a light knit for the layering effect"
      ],
      outer: [
        "Denim jacket, bomber, or a relaxed blazer depending on the weather",
        "A longline trench instantly elevates a plain jeans-and-tee combination"
      ],
      shoes: [
        "White leather sneakers, canvas high-tops or clean chunky trainers"
      ],
      acc: [
        "A crossbody bag, a plain cap and one or two pieces of simple jewellery"
      ],
      palette: "Denim blue, cream, grey and olive are a no-effort palette that all works together. Add one accent — rust, mustard or forest green.",
      fabrics: "Cotton, denim and cotton-blend knits are breathable and durable. A small amount of elastane keeps the shape without clinging.",
      tip: "Cuff your jeans just above the ankle and show a sliver of sock or skin — it makes the same outfit look intentionally styled.",
      alt: "If you'd rather keep it more relaxed, swap the overshirt for a plain heavyweight hoodie in the same colour family and keep everything else neutral."
    },
    {
      id: "street",
      label: "Streetwear",
      keywords: ["streetwear", "street", "hype", "urban", "trendy", "trend", "gen z", "genz", "sneaker", "sneakers", "oversized"],
      intro: "Streetwear lives or dies on proportion — one oversized piece balanced by one fitted piece, always.",
      base: [
        "An oversized graphic tee or boxy hoodie in heavyweight cotton",
        "Cargo pants, wide-leg denim or joggers with a clean cut at the ankle",
        "Layer a fitted long-sleeve underneath the tee for depth"
      ],
      outer: [
        "A varsity jacket, puffer or technical shell in a single bold colour",
        "Vintage-wash denim jacket is the reliable classic here"
      ],
      shoes: [
        "Chunky sneakers or retro runners — the anchor of the whole look",
        "Keep them genuinely clean; scuffs read careless, not cool"
      ],
      acc: [
        "A crossbody bag, a beanie or cap, and one chain or bold ring"
      ],
      palette: "Mostly monochrome (black, grey, cream) with a single saturated accent — cobalt, lime or orange. Too many colours breaks the effect.",
      fabrics: "Heavyweight cotton jersey and fleece hold the boxy silhouette. Nylon and technical fabrics add the modern, functional edge.",
      tip: "Tuck just the front of your tee and let the back hang — it defines the waist without losing the oversized feel.",
      alt: "If you'd rather keep it more relaxed, replace the cargos with straight-leg denim and drop the chain for a minimal look."
    },
    {
      id: "date",
      label: "Date / night out",
      keywords: ["date", "night out", "dinner date", "party", "club", "clubbing", "birthday", "celebration", "anniversary", "outing"],
      intro: "For a date or a night out, dress for the venue but always add one detail that makes you feel confident — that shows.",
      base: [
        "A fitted midi dress or a silk cami with tailored trousers",
        "Or a slim dark shirt with dark denim or chinos for a relaxed option"
      ],
      outer: [
        "A leather jacket, velvet blazer or longline coat for the walk there",
        "Keep the outer layer darker than the outfit — it frames everything"
      ],
      shoes: [
        "Heels, heeled boots, or polished Chelsea boots",
        "If dancing is likely, choose a heel you can genuinely stand in for hours"
      ],
      acc: [
        "One standout piece: a bold earring, a fine necklace, or a striking clutch",
        "A subtle fragrance on pulse points completes the look"
      ],
      palette: "Deep tones flatter evening light — burgundy, emerald, navy, or all-black with a metallic accent. Avoid pale shades under warm low lighting.",
      fabrics: "Satin, silk and velvet reflect the warm light of a restaurant or bar beautifully. For a sportier venue, a good-quality cotton or jersey knit holds shape.",
      tip: "Test your outfit sitting down in front of a mirror — that's how you'll actually spend most of the evening.",
      alt: "If you'd rather keep it more relaxed, a fine knit, dark tailored trousers and clean boots is understated and equally polished."
    },
    {
      id: "hot",
      label: "Hot / humid weather",
      keywords: ["hot", "summer", "humid", "humidity", "warm", "heat", "tropical", "beach", "sunny", "monsoon", "rain", "rainy", "wet"],
      intro: "In heat and humidity, fabric choice matters far more than style choice — the right fabric keeps you cool and looks intentional.",
      base: [
        "A breathable cotton or linen shirt, or a light viscose dress",
        "Loose silhouettes that let air move — never clingy fabrics in humidity",
        "Light colours reflect heat; dark absorbs it"
      ],
      outer: [
        "Skip heavy layers entirely; a light linen shirt worn open is your layer",
        "For rain, a lightweight shell and trousers that dry fast"
      ],
      shoes: [
        "Canvas sneakers, leather sandals or a light loafer",
        "Avoid heavy boots and anything you don't want waterlogged"
      ],
      acc: [
        "A straw hat or light cap, sunglasses, and a light crossbody bag",
        "Minimal jewellery — metal heats up against skin"
      ],
      palette: "White, ecru, pale blue, sage, soft yellow. A single bright accent (coral, turquoise) reads fresh and vacation-appropriate.",
      fabrics: "Linen and cotton breathe best; linen wrinkles by design, so embrace it. Viscose and rayon drape lightly. Avoid polyester — it traps heat and shows sweat.",
      tip: "A linen shirt worn open over a cotton tee gives coverage and airflow, and it handles humidity without clinging.",
      alt: "If you'd rather keep it more relaxed, a light cotton co-ord set — same fabric head to toe — is cool, cohesive and instantly stylish."
    },
    {
      id: "cold",
      label: "Cold weather",
      keywords: ["cold", "winter", "snow", "freezing", "chilly", "autumn", "fall", "layering", "coat", "jacket", "sweater", "wool"],
      intro: "Cold-weather style is about layering that looks deliberate — the base layer, the mid layer and the outer layer should each earn their place.",
      base: [
        "A thermal or fine merino base layer under a well-fitted knit",
        "Wool trousers or lined denim — not thin cotton",
        "Tuck the base layer in so the proportions stay clean"
      ],
      outer: [
        "A wool overcoat in camel, charcoal or navy is the timeless choice",
        "A puffer or parka for genuinely freezing weather",
        "Add a scarf in a colour that ties the whole outfit together"
      ],
      shoes: [
        "Leather boots, insulated lace-ups, or lined Chelsea boots",
        "Wool socks in a colour that echoes the trousers"
      ],
      acc: [
        "A knitted scarf, leather gloves and a wool beanie or structured felt hat"
      ],
      palette: "Camel, charcoal, cream and deep burgundy. Winter neutrals layer into each other effortlessly — keep the base and coat in the same family.",
      fabrics: "Merino wool, cashmere blends and wool-blend suiting hold warmth without bulk. Fleece-lined pieces are practical under less structured coats.",
      tip: "Keep the base layer thin and warm — the outer coat does the visual work, and a bulky base ruins the silhouette.",
      alt: "If you'd rather keep it more relaxed, a chunky knit, dark denim and a padded jacket with clean boots handles the cold and looks deliberately layered."
    }
  ];

  /* --- Colour advice -------------------------------------------------- */
  const COLOUR_FAMILIES = [
    { name: "Warm neutrals", swatches: "cream, oatmeal, camel, caramel, chocolate, warm navy", pairs: "Rust, terracotta, olive, mustard, burgundy", metals: "Gold and bronze" },
    { name: "Cool neutrals", swatches: "white, grey, charcoal, black, cool navy, slate", pairs: "Cobalt, berry, emerald, silver-blue", metals: "Silver and platinum" },
    { name: "Soft pastels", swatches: "blush, sage, powder blue, butter yellow, lilac", pairs: "White, grey, navy for grounding", metals: "Rose gold and pearl" },
    { name: "Jewel tones", swatches: "emerald, sapphire, ruby, amethyst, teal", pairs: "Black, navy, metallic accents", metals: "Gold and silver both work" },
    { name: "Earth tones", swatches: "olive, ochre, clay, rust, deep brown", pairs: "Cream, denim blue, burnt orange", metals: "Gold and copper" }
  ];

  const COLOUR_RULES = [
    "**60-30-10 rule:** 60% of the outfit in a dominant neutral, 30% in a secondary tone, and 10% in an accent. This is why a cream base with one bold bag looks so polished.",
    "**Undertone matching:** if your veins look green you lean warm — wear cream, camel and rust. If they look blue you lean cool — white, grey and true navy flatter you more.",
    "**Neutral as a bridge:** when two colours fight, set a neutral between them (a white shirt under a green blazer, a beige belt to separate navy and black).",
    "**One loud piece:** let exactly one item be the statement and keep everything else quiet. Two statement pieces cancel each other out.",
    "**Tonal dressing:** three shades of the same colour family always look expensive, even in very cheap fabrics."
  ];

  /* --- Fabric guide -------------------------------------------------- */
  const FABRICS = {
    cotton: "Cotton is breathable, durable and easy to wash — the safe default for everyday wear. Look for a dense, smooth weave; thin cotton goes shapeless fast.",
    linen: "Linen breathes better than anything else in humidity and has a natural, expensive texture. It wrinkles by design — lean into it, don't fight it.",
    silk: "Silk drapes beautifully and catches light, making it ideal for evening. It dyes rich colour well; always check the care label and hand-wash or dry-clean.",
    satin: "Satin gives a silk-like sheen at a lower price. Great for evening, but shiny synthetics can reflect camera flash badly — favour a matte satin for photos.",
    chiffon: "Chiffon is light, sheer and floaty — perfect for layering and modest styling. It needs an opaque layer underneath and holds colour well.",
    wool: "Wool keeps its shape through a long day and insulates even when thin. Wool-blend suiting is the backbone of formal tailoring.",
    denim: "Denim is the most versatile casual fabric. A small amount of elastane keeps the shape, and heavier weights hold a clean silhouette.",
    leather: "Leather is an instant structure and edge piece. It moulds to your body over time; keep it conditioned and out of prolonged direct sun."
  };

  /* --- Body-shape guidance (body-neutral, positive) ------------------ */
  const SHAPES = {
    petite: "Petite frames look taller when the outfit is one tonal column, with a slightly higher waistline and a hem that ends at the ankle — avoid midi lengths that cut the leg.",
    tall: "Tall frames carry longline coats, wide-leg trousers and maxi skirts especially well. Break up the vertical with belts and statement pieces to add interest.",
    curvy: "Curvy figures look their best when fabric follows the shape rather than clinging. Choose structured tops, wrap or fit-and-flare silhouettes, and define the waist with a belt.",
    apple: "For an apple shape, elongate with V-necks, vertical seams and open jackets worn over a slim base — this draws the eye vertically and looks beautifully balanced.",
    pear: "For a pear shape, put detail and lighter colour on the top half, darker plain tones on the bottom, and define the waistline. A structured shoulder always flatters.",
    rectangle: "Straight up-and-down frames benefit from layers that create curve — belted coats, peplum, and mixing a fitted piece with a voluminous one."
  };

  /* --- Budget tips --------------------------------------------------- */
  const BUDGET_TIPS = [
    "Spend on the pieces you wear weekly — shoes, a coat, and one good bag. Save on trend items you'll rotate in a season.",
    "A capsule of 12-15 pieces in one palette gives you more outfits than 40 random items. Buy within the palette.",
    "Thrift stores and consignment are unbeatable for blazers, coats and leather — focus on fit rather than brand.",
    "A good tailor is cheaper than a new wardrobe. Taking in a waist or hemming trousers transforms a budget piece.",
    "Buy the neutral version of a trend first — if you love it, add the bolder colour next season."
  ];

  /* --- Non-fashion deflection ---------------------------------------- */
  const NON_FASHION = [
    "coding", "programming", "java", "python", "javascript", "math", "maths",
    "equation", "physics", "chemistry", "politics", "election", "president",
    "medicine", "medical", "symptom", "doctor", "diagnosis", "drug", "surgery",
    "crypto", "bitcoin", "stock", "invest", "news", "war", "history", "essay",
    "homework", "translate", "song", "lyrics"
  ];

  const COLOUR_WORDS = [
    "black", "white", "cream", "ivory", "beige", "nude", "camel", "tan", "brown",
    "chocolate", "grey", "gray", "charcoal", "silver", "navy", "blue", "cobalt",
    "teal", "turquoise", "green", "olive", "sage", "emerald", "mint", "yellow",
    "mustard", "gold", "orange", "rust", "terracotta", "coral", "peach", "pink",
    "blush", "rose", "red", "maroon", "burgundy", "wine", "purple", "lilac",
    "lavender", "plum", "violet", "metallic", "denim"
  ];

  /* Defining keywords. When one of these appears, its occasion becomes the
     primary brief even if a generic word (evening, ceremony, dinner) also
     matches another occasion. Multi-word terms are listed first. */
  const DEFINING_TERMS = [
    { term: "black tie", id: "formal" },
    { term: "wedding", id: "wedding" },
    { term: "bridal", id: "wedding" },
    { term: "bride", id: "wedding" },
    { term: "groom", id: "wedding" },
    { term: "nikah", id: "wedding" },
    { term: "sangeet", id: "wedding" },
    { term: "mehndi", id: "wedding" },
    { term: "engagement", id: "wedding" },
    { term: "interview", id: "interview" },
    { term: "internship", id: "interview" },
    { term: "recruiter", id: "interview" },
    { term: "hijab", id: "modest" },
    { term: "abaya", id: "modest" },
    { term: "kaftan", id: "modest" },
    { term: "saree", id: "modest" },
    { term: "modest", id: "modest" },
    { term: "streetwear", id: "street" },
    { term: "gala", id: "formal" },
    { term: "prom", id: "formal" },
    { term: "university", id: "uni" },
    { term: "campus", id: "uni" },
    { term: "college", id: "uni" },
    { term: "lecture", id: "uni" }
  ];

  /* ======================================================================
     4. INTENT ANALYSIS
  ====================================================================== */
  /* Whole-word / phrase test. Terms may contain spaces; word boundaries are
     applied at the outer edges only, so "black tie" matches but "war" does not
     match "wardrobe". */
  function makeMatcher(text) {
    return function contains(term) {
      const t = String(term).toLowerCase();
      if (!t) return false;
      const esc = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp("(^|\\W)" + esc + "(\\W|$)").test(text);
    };
  }

  function analyse(message) {
    const text = String(message).toLowerCase().replace(/[^a-z0-9\s']/g, " ").replace(/\s+/g, " ");
    const contains = makeMatcher(text);
    const has = (words) => words.some((w) => contains(w));

    /* Match occasions by whole words, then rank so a defining keyword
       (wedding, interview, black tie, hijab...) outranks generic terms that
       also appear in other lists (evening, ceremony, dinner). */
    const matchedOccasions = OCCASIONS
      .map((o) => {
        const hits = o.keywords.filter((k) => contains(k));
        let score = hits.length;

        // A defining keyword promoted to this occasion is a strong signal.
        if (DEFINING_TERMS.some((d) => d.id === o.id && contains(d.term))) score += 10;

        // Longer matched keywords carry more meaning than short ones.
        score += hits.reduce((sum, k) => sum + (k.indexOf(" ") !== -1 ? 2 : k.length > 6 ? 1 : 0), 0);

        return { occasion: o, score };
      })
      .filter((m) => m.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((m) => m.occasion);

    const isNonFashion =
      NON_FASHION.some((k) => contains(k)) &&
      !has(["style", "wear", "outfit", "fashion", "clothes", "dress", "shirt", "look", "colour", "color", "suit"]);

    const coloursFound = COLOUR_WORDS.filter((c) => contains(c));
    const fabricFound = Object.keys(FABRICS).filter((f) => contains(f));

    const flags = {
      colour: has(["colour", "color", "colours", "colors", "match", "matches", "matching", "combination", "combine", "palette", "goes", "go"]) || coloursFound.length >= 2,
      fabric: has(["fabric", "fabrics", "material", "textile", "cloth", "linen", "cotton", "silk", "satin", "wool", "denim", "leather"]) || fabricFound.length > 0,
      budget: has(["budget", "cheap", "affordable", "save", "saving", "economical", "money", "expensive", "capsule", "thrift"]),
      shape: has(["petite", "tall", "curvy", "curve", "apple", "pear", "rectangle", "figure", "proportion", "height"]),
      modest: has(["modest", "hijab", "abaya", "kaftan", "conservative", "covered", "saree", "shalwar", "dupatta"])
    };

    const greeting = /^\s*(hi|hey|hello|yo|hola|salam|assalam|good morning|good afternoon|good evening)\b/i.test(message);
    const thanks = /^\s*(thanks|thank you|thx|ty|shukriya|jazak)\b/i.test(message);
    const whoAreYou = /(who are you|what are you|your name|are you a bot|are you human|what can you do|help me|how do you work)/i.test(message);

    return {
      raw: message,
      matchedOccasions,
      primary: matchedOccasions[0] || null,
      coloursFound,
      fabricFound,
      flags,
      greeting,
      thanks,
      whoAreYou,
      isNonFashion
    };
  }

  /* ======================================================================
     5. OFFLINE STYLIST ENGINE — builds the reply (markdown-lite)
  ====================================================================== */
  function stylistReply(userMessage) {
    const a = analyse(userMessage);

    if (a.isNonFashion && !a.primary && !a.flags.colour && !a.flags.fabric) {
      return "I'd love to help, but I'm StyleSense AI and I only style people — fashion, outfits, colours and fabrics. 👗\n\n" +
        "Tell me what you're dressing for — a lecture, an interview, a wedding, a night out — plus the weather if you can, and I'll build you a complete look.";
    }

    if (a.whoAreYou) {
      return "I'm **StyleSense AI**, your personal fashion stylist. I put together complete outfits — clothes, shoes, accessories, colour palettes and fabric choices — for whatever you're dressing for.\n\n" +
        "**I can help with:**\n" +
        "- University, casual, streetwear and smart-casual\n" +
        "- Formal, office, interviews and black tie\n" +
        "- Weddings, guest dressing and cultural ceremonies\n" +
        "- Modest fashion — hijab styling, abayas, sarees and more\n" +
        "- Colour combinations, fabric choices and body-shape guidance\n" +
        "- Capsule wardrobes and budget styling\n\n" +
        "What's the occasion? Tell me a little about it and I'll get started.";
    }

    if (a.greeting && !a.primary && !a.flags.colour && !a.flags.fabric) {
      return "Hello! 👗 I'm **StyleSense AI**, your personal fashion stylist. Tell me the occasion — a lecture, a job interview, a wedding, a night out — and a little about the weather, and I'll put together a complete look for you.";
    }

    if (a.thanks && !a.primary) {
      return "You're very welcome. ✨ If you'd like, I can add a colour palette, a fabric recommendation, or a more formal or more relaxed version of that look — just say which.";
    }

    if (a.flags.colour && !a.primary && !a.flags.budget && !a.flags.shape) return colourReply(a);
    if (a.flags.fabric && !a.primary && !a.flags.colour && !a.flags.budget && !a.flags.shape) return fabricReply(a);
    if (a.flags.budget && !a.primary) return budgetReply(a);
    if (a.flags.shape && !a.primary) return shapeReply(a);

    return outfitReply(a);
  }

  /* --- Outfit reply -------------------------------------------------- */
  function outfitReply(a) {
    const occ = a.primary || OCCASIONS.find((o) => o.id === "casual");
    const second = a.matchedOccasions[1];

    let out = occ.intro + "\n\n";

    out += "### The base\n" + occ.base.map((b) => "- " + b).join("\n") + "\n";

    if (occ.outer && occ.outer.length) {
      out += "\n### Layering & outerwear\n" + occ.outer.map((b) => "- " + b).join("\n") + "\n";
    }

    out += "\n### Shoes\n" + occ.shoes.map((b) => "- " + b).join("\n") + "\n";
    out += "\n### Accessories\n" + occ.acc.map((b) => "- " + b).join("\n") + "\n";

    let paletteLine = occ.palette;
    if (a.coloursFound.length) {
      paletteLine += "\n\nSince you mentioned **" + a.coloursFound.join(", ") + "**: " + paletteWithColours(a.coloursFound);
    }
    out += "\n### Colour palette\n" + paletteLine + "\n";

    let fabricLine = occ.fabrics;
    if (a.fabricFound.length) {
      fabricLine = a.fabricFound
        .map((f) => "- **" + f.charAt(0).toUpperCase() + f.slice(1) + ":** " + FABRICS[f])
        .join("\n") + "\n\n" + occ.fabrics;
    }
    out += "\n### Fabrics & textures\n" + fabricLine + "\n";

    if (a.flags.modest && occ.id !== "modest") {
      out += "\n> **Modest note:** keep the silhouette covered with a long-sleeve base, a fluid midi or maxi length, and one long layer.\n";
    }
    if (a.flags.budget) {
      out += "\n> **Budget note:** " + pick(BUDGET_TIPS) + "\n";
    }
    if (a.flags.shape) {
      out += "\n> **Fit note:** focus on the neckline and waistline first — those two points determine whether an outfit flatters.\n";
    }

    out += "\n### Stylist tip\n" + occ.tip + "\n";
    out += "\n### If you'd like an alternative\n" + occ.alt;

    if (second && second.id !== occ.id) {
      out += "\n\nAlso — since this overlaps with a **" + second.label.toLowerCase() + "** brief, tell me which one takes priority and I'll refine the whole look toward it.";
    } else {
      out += "\n\nTell me the weather and anything you already want to wear, and I'll tighten this up around your exact plans.";
    }

    return out;
  }

  /* --- Colour reply -------------------------------------------------- */
  function colourReply(a) {
    let out = "";

    if (a.coloursFound.length >= 2) {
      const c = a.coloursFound.slice(0, 3);
      const has = (x) => c.indexOf(x) !== -1;
      const warm = ["cream", "beige", "nude", "camel", "tan", "brown", "chocolate", "gold", "mustard", "yellow", "orange", "rust", "terracotta", "coral", "peach", "maroon", "burgundy", "wine", "red"];
      const cool = ["white", "grey", "gray", "charcoal", "silver", "navy", "blue", "cobalt", "teal", "turquoise", "green", "olive", "sage", "emerald", "mint", "pink", "blush", "rose", "purple", "lilac", "lavender", "plum", "violet", "denim"];

      out += "**" + c.join(" & ") + " together** — here's my honest read:\n\n";

      if (has("black") || has("white") || has("grey") || has("gray") || has("beige") || has("cream") || has("nude") || has("navy")) {
        out += "Neutrals are doing the heavy lifting here, which is good — it means the combination will always look intentional, from a lecture hall to a dinner.\n\n";
      }

      const cWarm = c.filter((x) => warm.indexOf(x) !== -1).length;
      const cCool = c.filter((x) => cool.indexOf(x) !== -1).length;

      if (cWarm && cCool) {
        out += "You're mixing **warm and cool tones**. That works, but it needs a bridge. Add a neutral between them — white, cream, grey or denim — and keep the warmer colour closer to your face.\n\n";
      } else if (cWarm) {
        out += "This is a fully **warm-toned** combination. It looks rich and cohesive, especially in autumn and under warm indoor lighting. Ground it with cream, camel or brown rather than grey.\n\n";
      } else if (cCool) {
        out += "This is a fully **cool-toned** combination. It looks crisp and modern and photographs beautifully in daylight. Ground it with white, grey or silver rather than a warm tan.\n\n";
      }

      out += "**How I'd build it:**\n";
      out += "- Put the **darkest** colour on the largest surface (trousers, coat or dress)\n";
      out += "- Use the **lightest** colour near the face — it lifts your complexion\n";
      out += "- Keep **one** colour as the accent only: shoes, bag or jewellery\n\n";
      out += "**Balance rule:** " + pick(COLOUR_RULES) + "\n";
      return out;
    }

    out += "Colour is where most outfits are won or lost, so let's do this properly.\n\n";

    if (a.coloursFound.length === 1) {
      const base = a.coloursFound[0];
      out += "**Styling around " + base + ":**\n";
      out += "- **Pairs beautifully with:** " + pairingFor(base) + "\n";
      out += "- **Keep it neutral with:** white, cream, grey, black or denim so the colour can breathe\n";
      out += "- **Metals that work:** " + metalFor(base) + "\n\n";
      out += "Put " + base + " on the piece you want noticed — a shirt, a dress or a bag — and keep the rest quiet. That's what makes a bold colour look expensive rather than loud.\n\n";
    }

    out += "### The five palettes that always work\n";
    out += COLOUR_FAMILIES.map((f) => "- **" + f.name + ":** " + f.swatches + " · pairs with " + f.pairs + " · metals: " + f.metals).join("\n") + "\n";

    out += "\n### Rules worth remembering\n";
    out += COLOUR_RULES.map((r) => "- " + r).join("\n");

    out += "\n\nTell me the specific colours you're working with and the occasion, and I'll tell you exactly which one to put where.";
    return out;
  }

  function pairingFor(colour) {
    const map = {
      olive: "cream, camel, rust, mustard, denim blue and warm brown",
      green: "cream, navy, brown leather, gold jewellery, camel and blush",
      navy: "cream, white, camel, burgundy, blush, grey and olive",
      black: "absolutely everything — best with white, camel, red or cream for contrast",
      white: "denim, navy, camel, olive, blush and pastel tones",
      grey: "navy, blush, white, burgundy, mustard and all cool tones",
      blush: "grey, navy, cream, sage and gold jewellery",
      mustard: "navy, cream, forest green, brown leather and olive",
      rust: "cream, sage, denim blue, chocolate brown and gold",
      burgundy: "cream, navy, camel, forest green and gold",
      teal: "cream, camel, coral, gold and navy",
      lilac: "white, grey, navy, sage and silver jewellery",
      camel: "cream, black, navy, olive, rust and gold",
      denim: "literally everything — that's why it's a staple"
    };
    return map[colour] || "white, cream, grey, navy and denim — the universal neutral set";
  }

  function metalFor(colour) {
    const map = {
      navy: "gold and silver both",
      black: "silver, platinum or gold depending on the warmth of your skin",
      cream: "gold and bronze",
      camel: "gold and bronze",
      rust: "gold and copper",
      burgundy: "gold and silver",
      olive: "gold and bronze",
      blush: "rose gold and pearl",
      white: "silver and gold both",
      grey: "silver and platinum",
      teal: "gold",
      lilac: "silver and pearl",
      mustard: "gold and bronze"
    };
    return map[colour] || "gold and silver both work — match your metal to your outfit's temperature";
  }

  function paletteWithColours(colours) {
    if (colours.length === 1) {
      return "put **" + colours[0] + "** on your hero piece and keep everything else in a neutral from the same temperature family. It pairs best with " + pairingFor(colours[0]) + ".";
    }
    const c = colours.slice(0, 2);
    return "use **" + c[0] + "** as the dominant tone and **" + c[1] + "** as the accent — never split them 50/50, or the outfit will look unresolved.";
  }

  /* --- Fabric reply -------------------------------------------------- */
  function fabricReply(a) {
    const fabrics = a.fabricFound.length ? a.fabricFound : ["cotton", "linen", "silk"];

    let out = "Fabric is the difference between 'dressed' and 'styled' — here's how these behave.\n\n";
    out += "### Face value\n";
    out += fabrics.map((f) => "- **" + f.charAt(0).toUpperCase() + f.slice(1) + ":** " + FABRICS[f]).join("\n");

    out += "\n### Choosing by situation\n";
    out += "- **Hot or humid:** linen and cotton first; viscose next. Avoid polyester — it traps heat and shows sweat.\n";
    out += "- **Cold:** merino wool, wool blends and fleece-lined pieces give warmth without bulk.\n";
    out += "- **Formal or evening:** silk, satin, crepe and velvet — they hold their shape and reflect light well.\n";
    out += "- **Everyday and durable:** denim, heavyweight cotton and cotton jersey keep their shape.\n";
    out += "- **Modest styling:** chiffon and crepe for drape and coverage; jersey for holdable layers.\n";

    out += "\n### Practical guidance\n";
    out += "- Steam rather than iron delicate fabrics; always check the care label first\n";
    out += "- A blend often behaves better than a pure fibre — 2-5% elastane stops fabric losing its shape\n";
    out += "- Matte fabrics photograph more reliably than shiny synthetics\n";

    out += "\n### Stylist tip\nChoose the fabric first and the style second — a beautiful cut in the wrong fabric will be uncomfortable by lunchtime, and comfort shows in how you carry yourself.";
    return out;
  }

  /* --- Budget reply -------------------------------------------------- */
  function budgetReply(a) {
    let out = "Styling well on a budget is genuinely a skill, and you already have the right instinct by asking.\n\n";

    out += "### Build a capsule first\n";
    out += "- 2 well-fitted trousers (one neutral, one darker)\n";
    out += "- 3 tops in one colour family\n";
    out += "- 1 blazer, 1 knit layer, 1 statement piece\n";
    out += "- 1 pair of shoes you'll wear four times a week\n\n";

    out += "### Where the money pays off\n";
    out += BUDGET_TIPS.map((t) => "- " + t).join("\n");

    out += "\n### Shopping strategy\n";
    out += "- Buy within one palette so every new piece works with what you own\n";
    out += "- Shop end-of-season for next year's basics; that's when neutral stock drops\n";
    out += "- Check the composition label before the brand — fabric quality is the real value signal\n";
    out += "- Fit matters more than price: a cheap jacket tailored well beats an expensive baggy one\n";

    if (a.primary) {
      out += "\n### For your occasion\nBecause you're dressing for a **" + a.primary.label.toLowerCase() + "**, spend on the piece you'll wear most often. " + a.primary.tip;
    } else {
      out += "\nTell me the occasion and I'll map this capsule onto it specifically.";
    }
    return out;
  }

  /* --- Body-shape reply ---------------------------------------------- */
  function shapeReply(a) {
    const text = String(a.raw || "").toLowerCase();
    const key = Object.keys(SHAPES).find((s) => text.indexOf(s) !== -1);

    let out = "Great question — fit is what actually makes an outfit flattering, and most people skip this step entirely.\n\n";

    if (key) {
      out += "**For a " + key + " frame:** " + SHAPES[key] + "\n\n";
    } else {
      out += "### Universal fit principles\n";
      out += "- **Neckline is the highest-impact choice.** A V-neck or open collar elongates; crew necks shorten.\n";
      out += "- **Define or disrupt the waistline deliberately.** Either belt it, or go structured and boxy — never in between.\n";
      out += "- **Balance volume with fit.** If the top is oversized, the bottom should be fitted, and vice versa.\n";
      out += "- **Hem where it helps.** Crop at the natural waist or go long — avoid ending at the widest point.\n";
      out += "- **The shoulder seam should sit on your actual shoulder.** This detail makes any garment look tailored.\n\n";
    }

    out += "### Per body shape\n";
    out += Object.keys(SHAPES).map((s) => "- **" + s.charAt(0).toUpperCase() + s.slice(1) + ":** " + SHAPES[s]).join("\n");

    out += "\n### Stylist tip\nStand in front of a mirror in an outfit you already love and note the neckline, the hem and the waistline. Those three coordinates work for you — repeat them, whatever the occasion.";
    return out;
  }

  /* ======================================================================
     6. HOSTED ENGINE (OpenAI-compatible /chat/completions)
  ====================================================================== */
  const history = []; // { role: "user" | "assistant", content: string }

  function buildMessages() {
    const msgs = [{ role: "system", content: CFG.systemPrompt || "You are a helpful fashion assistant." }];
    const turns = Math.max(1, API.contextTurns || 8) * 2;
    return msgs.concat(history.slice(-turns));
  }

  function authHeaders() {
    const headers = {
      "Content-Type": "application/json",
      "Accept": "application/json"
    };
    if (API.authStyle === "bearer" && API.apiKey) {
      headers["Authorization"] = "Bearer " + API.apiKey;
    } else if (API.authStyle === "x-api-key" && API.apiKey) {
      headers["x-api-key"] = API.apiKey;
    } else if (API.authStyle === "x-proxy-token" && API.apiKey) {
      headers["x-proxy-token"] = API.apiKey;
    } else if (API.apiKey && API.apiKeyHeader) {
      headers[API.apiKeyHeader] = API.apiKey;
    }
    return headers;
  }

  async function callHosted(message) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), API.timeoutMs || 30000);

    try {
      history.push({ role: "user", content: message });

      const res = await fetch(API.baseUrl, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          model: API.model || "openai/gpt-oss-120b",
          messages: buildMessages(),
          temperature: typeof API.temperature === "number" ? API.temperature : 0.8,
          max_tokens: API.maxTokens || 900,
          top_p: typeof API.topP === "number" ? API.topP : 0.95,
          stream: false
        }),
        signal: controller.signal
      });

      if (!res.ok) throw new Error("Endpoint responded with " + res.status);

      const data = await res.json();
      const choice = data && data.choices && data.choices[0];
      const text = choice && ((choice.message && choice.message.content) || choice.text);

      if (!text || !String(text).trim()) throw new Error("Empty completion");

      const answer = String(text).trim();
      history.push({ role: "assistant", content: answer });
      return answer;
    } finally {
      clearTimeout(timer);
    }
  }

  function hostedAvailable() {
    if (!API.enabled || !API.baseUrl) return false;
    if (API.allowKeyless) return true;
    return Boolean(API.apiKey);
  }

  /* ======================================================================
     7. CHAT UI
  ====================================================================== */
  const els = {};
  let isBusy = false;
  let typeTimer = null;
  const PERSIST_KEY = "stylesense.history.v1";

  function cacheEls() {
    els.messages = $("#chatMessages");
    els.form = $("#chatForm");
    els.input = $("#chatInput");
    els.send = $("#sendBtn");
    els.status = $("#chatStatus");
    els.badge = $("#modeBadge");
    els.hint = $("#engineHint");
    els.clear = $("#clearChat");
    els.suggestions = $("#chatSuggestions");
  }

  function botAvatar() {
    return '<div class="msg-avatar" aria-hidden="true">' +
      '<svg viewBox="0 0 32 32"><path d="M16 3c2.6 0 4.6 1.9 4.9 4.4l4.6 1.4c1.6.5 2.6 2 2.4 3.6l-.9 7.2c-.2 1.5-1.5 2.6-3 2.6h-5.4l-.5 4.6c-.1 1.3-1.2 2.2-2.5 2.2H12c-1.4 0-2.5-1.1-2.5-2.5v-3.7c0-.6-.2-1.1-.5-1.6l-3-4.3c-1-1.4-.6-3.4 1-4.2l4.6-2.4C12 5.1 13.8 3 16 3Z" fill="currentColor"/></svg>' +
      "</div>";
  }

  function userAvatar() {
    return '<div class="msg-avatar" aria-hidden="true">You</div>';
  }

  function scrollToBottom(instant) {
    if (!els.messages) return;
    if (instant) {
      els.messages.scrollTop = els.messages.scrollHeight;
    } else {
      try {
        els.messages.scrollTo({ top: els.messages.scrollHeight, behavior: "smooth" });
      } catch (e) {
        els.messages.scrollTop = els.messages.scrollHeight;
      }
    }
  }

  function addMessage(role, content, options) {
    const opts = options || {};
    const wrap = document.createElement("div");
    wrap.className = "msg " + (role === "user" ? "msg-user" : "msg-bot");

    const avatar = role === "user" ? userAvatar() : botAvatar();
    const body = role === "user"
      ? "<p>" + escapeHtml(content).replace(/\n/g, "<br>") + "</p>"
      : renderMarkdown(content);

    wrap.innerHTML = avatar + '<div class="bubble">' + body + "</div>";
    if (!els.messages) return wrap;

    els.messages.appendChild(wrap);
    scrollToBottom();

    if (role !== "user" && opts.typewriter) {
      typewriteBubble(wrap.querySelector(".bubble"), content);
    }

    saveHistory();
    return wrap;
  }

  /* Progressive reveal so a long answer feels considered, not dumped. */
  function typewriteBubble(bubble, fullText) {
    const speed = typeof UI.typewriterSpeed === "number" ? UI.typewriterSpeed : 9;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!bubble || !speed || speed <= 0 || reduced || fullText.length > 2600) return;

    clearTimeout(typeTimer);
    let shown = 0;
    const step = Math.max(1, Math.round(fullText.length / 240));

    const advance = () => {
      shown = Math.min(fullText.length, shown + step);
      bubble.innerHTML = renderMarkdown(fullText.slice(0, shown));
      scrollToBottom();
      if (shown < fullText.length) {
        typeTimer = setTimeout(advance, speed);
      } else {
        bubble.innerHTML = renderMarkdown(fullText);
        scrollToBottom();
      }
    };
    advance();
  }

  function addTyping() {
    const wrap = document.createElement("div");
    wrap.className = "msg msg-bot";
    wrap.id = "typingMsg";
    wrap.innerHTML = botAvatar() +
      '<div class="bubble"><span class="typing" aria-label="StyleSense is typing"><i></i><i></i><i></i></span></div>';
    if (els.messages) els.messages.appendChild(wrap);
    scrollToBottom();
  }

  function removeTyping() {
    const t = document.getElementById("typingMsg");
    if (t) t.remove();
  }

  function setBusy(state) {
    isBusy = state;
    if (els.send) els.send.disabled = state;
    if (els.input) els.input.setAttribute("aria-busy", state ? "true" : "false");
  }

  function setStatus(text) {
    if (els.status) els.status.textContent = text;
  }

  function shortHost(url) {
    try { return new URL(url).host; } catch (e) { return url || ""; }
  }

  function updateEngineIndicator() {
    const live = hostedAvailable();
    if (els.badge) {
      els.badge.textContent = live ? "Hosted model" : "Stylist engine";
      els.badge.classList.toggle("is-live", live);
      els.badge.title = live
        ? "Responses are generated by the connected model endpoint"
        : "Responses are generated by the built-in offline fashion engine";
    }
    if (els.hint) {
      els.hint.innerHTML = live
        ? "Connected to <code>" + escapeHtml(shortHost(API.baseUrl)) + "</code>."
        : "Add an API key in <code>js/config.js</code> to use a hosted model.";
    }
  }

  /* --- Suggestion chips ---------------------------------------------- */
  function renderSuggestions(list) {
    if (!els.suggestions) return;
    els.suggestions.innerHTML = "";
    const items = (list || (UI.suggestions || [])).slice(0, 4);
    items.forEach((text) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sugg";
      btn.textContent = text.length > 54 ? text.slice(0, 52) + "..." : text;
      btn.title = text;
      btn.addEventListener("click", () => {
        if (isBusy || !els.input) return;
        els.input.value = text;
        autoGrow();
        submit();
      });
      els.suggestions.appendChild(btn);
    });
  }

  function rotateSuggestions() {
    const pool = (UI.suggestions || []).slice();
    if (pool.length <= 4) { renderSuggestions(pool); return; }
    const asked = history.filter((h) => h.role === "user").map((h) => h.content.toLowerCase());
    const fresh = pool.filter((p) => asked.indexOf(p.toLowerCase()) === -1);
    renderSuggestions(sample(fresh.length >= 4 ? fresh : pool, 4));
  }

  /* --- Core send flow ------------------------------------------------ */
  async function submit() {
    if (isBusy || !els.input) return;
    const text = els.input.value.trim();
    if (!text) return;

    els.input.value = "";
    autoGrow();

    addMessage("user", text, { typewriter: false });
    setBusy(true);
    setStatus("Styling your look...");
    addTyping();

    let answer = null;
    let usedHosted = false;

    if (hostedAvailable()) {
      try {
        answer = await callHosted(text);
        usedHosted = true;
      } catch (err) {
        console.warn("[StyleSense] Hosted request failed, falling back to the offline engine:", err && err.message);
        answer = null;
      }
    }

    if (!answer) {
      if (!usedHosted) history.push({ role: "user", content: text });
      const think = rand(UI.thinkingMin || 450, UI.thinkingMax || 1000);
      await sleep(think);
      answer = stylistReply(text);
      history.push({ role: "assistant", content: answer });
    }

    removeTyping();
    addMessage("assistant", answer, { typewriter: true });
    rotateSuggestions();

    setBusy(false);
    setStatus(usedHosted ? "Online · hosted model" : "Online · ready to style you");
    if (!("ontouchstart" in window)) els.input.focus();
  }

  function autoGrow() {
    if (!els.input) return;
    els.input.style.height = "auto";
    els.input.style.height = Math.min(els.input.scrollHeight, 140) + "px";
  }

  /* --- Persistence --------------------------------------------------- */
  function saveHistory() {
    if (!UI.persistHistory || !els.messages) return;
    try {
      const payload = {
        v: 1,
        at: Date.now(),
        history: history.slice(-40),
        ui: Array.from(els.messages.children).slice(-40).map((n) => ({
          role: n.classList.contains("msg-user") ? "user" : "assistant",
          html: n.querySelector(".bubble") ? n.querySelector(".bubble").innerHTML : ""
        }))
      };
      localStorage.setItem(PERSIST_KEY, JSON.stringify(payload));
    } catch (e) { /* storage unavailable — ignore */ }
  }

  function loadHistory() {
    if (!UI.persistHistory || !els.messages) return false;
    let data = null;
    try { data = JSON.parse(localStorage.getItem(PERSIST_KEY) || "null"); } catch (e) { data = null; }
    if (!data || !data.ui || !data.ui.length) return false;
    if (data.at && Date.now() - data.at > 24 * 60 * 60 * 1000) return false;

    (data.history || []).forEach((h) => history.push(h));

    data.ui.forEach((m) => {
      const wrap = document.createElement("div");
      wrap.className = "msg " + (m.role === "user" ? "msg-user" : "msg-bot");
      /* m.html was produced by our own renderer from escaped input, so
         restoring it is safe and preserves formatting. */
      wrap.innerHTML = (m.role === "user" ? userAvatar() : botAvatar()) +
        '<div class="bubble">' + m.html + "</div>";
      els.messages.appendChild(wrap);
    });

    scrollToBottom(true);
    return true;
  }

  function clearChat() {
    if (!els.messages) return;
    clearTimeout(typeTimer);
    removeTyping();
    els.messages.innerHTML = "";
    history.length = 0;
    try { localStorage.removeItem(PERSIST_KEY); } catch (e) { /* ignore */ }
  }

  function startConversation() {
    const greeting = BRAND.greeting || "Hi! How can I help you style yourself today?";
    history.push({ role: "assistant", content: greeting });
    addMessage("assistant", greeting, { typewriter: true });
    rotateSuggestions();
  }

  /* ======================================================================
     8. INIT
  ====================================================================== */
  function init() {
    cacheEls();
    if (!els.messages || !els.form || !els.input) return; // chat not present

    updateEngineIndicator();

    els.form.addEventListener("submit", (e) => {
      e.preventDefault();
      submit();
    });

    els.input.addEventListener("input", autoGrow);
    els.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        submit();
      }
    });

    if (els.clear) {
      els.clear.addEventListener("click", () => {
        clearChat();
        startConversation();
        els.input.focus();
      });
    }

    const restored = loadHistory();
    if (restored) {
      rotateSuggestions();
      setStatus("Online · ready to style you");
    } else {
      startConversation();
    }

    /* Let the gallery / hero / CTA sections seed a prompt into the chat. */
    document.addEventListener("stylesense:ask", (e) => {
      const q = e && e.detail && e.detail.question;
      if (!q) return;
      els.input.value = q;
      autoGrow();
      submit();
    });

    /* Small public API (handy for console testing and integrations). */
    window.StyleSense = {
      chat: (msg) => { els.input.value = msg; autoGrow(); return submit(); },
      reset: () => { clearChat(); startConversation(); },
      history: () => history.slice(),
      engine: () => (hostedAvailable() ? "hosted" : "offline"),
      reply: (msg) => stylistReply(msg)
    };

    /* Keep the engine indicator honest if the tab regains focus. */
    window.addEventListener("focus", updateEngineIndicator);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
