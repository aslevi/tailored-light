// Key texts from the Dana playbook (work/dana/dana-playbook.md), grouped by stage.
// [brackets] are filled from the lead where possible; anything left in [brackets] still needs Dana.
export const GROUPS = [
  { id: 'first', title: 'First reply', stages: ['new'], items: [
    ['First reply', 'Hi [name]! Dana here. [Fabric] in [color] is such a good pick for a [room]. Happy to help you measure and price it.'],
    ['Other rooms?', 'Quick one first: is it just the [room], or are you doing other rooms too?'],
    ['After hours', "Hi! Dana here. Got your [room] design and I love it. I'm away from my phone right now, I'll text you back by [time]."],
  ] },
  { id: 'kit', title: 'Swatch kit', stages: ['new', 'swatches'], items: [
    ['Kit: yes', "Yes! Love that you're leaning [fabric] in [color]. Swatches are free, shipping too. Pick up to 5 and send me your address."],
    ['Kit: address', "I'll put in [color] plus 2–3 that I think would also work in a [room]. What's the best mailing address?"],
    ['Kit offer', "Want to feel it first? I'll mail you free swatches, up to 5 fabrics. I'll include [color] plus a couple I think you'll like."],
    ['Ready buyer', "You can skip swatches if you're happy with [color]. Or I can send them and we measure while they're in the mail, no time lost."],
    ['Kit shipped', "Your swatches are on the way! Tip: tape them to the window and look at them morning and evening. While you wait, want to measure? Takes about 10 minutes and I'll walk you through it."],
  ] },
  { id: 'qualify', title: 'Qualify & recommend', stages: ['new', 'qualified'], items: [
    ['Rooms', 'Which rooms are you thinking about?'],
    ['Window count', 'How many windows in the [room]? Roughly how big, like "standard" or "big picture window"?'],
    ['How dark', 'How dark do you want it in there? Soft and filtered, or pitch black for naps and sleeping in?'],
    ['Privacy / glare', 'For the [room], is it more about privacy, glare, or just looking finished?'],
    ['Timeline', 'Any timing you\'re working toward? Shades ship 2–4 weeks after you order.'],
    ['Photo', 'Can you send me a photo of the window? Stand back so I can see the whole frame and a bit of wall around it.'],
    ['Rec: bedroom', "For a [room], I'd go with a roller. Deep Sleep is our blackout fabric. Mounted on the wall above the frame, it blocks the most light. Nursery parents love it."],
    ['Rec: kitchen', 'For a kitchen I love woven wood. Natural Reed in [Honey/Natural/Driftwood] adds warmth, filters light nicely, and doesn\'t look fussy.'],
    ['Rec: living, polish', 'For the [room], a Roman feels the most finished. [Fabric] in [color] looks great with [what\'s in their photo].'],
    ['Rec: zebra', 'If you want to fine-tune light during the day, a zebra is great. Two layers slide to go from open view to privacy without raising it.'],
    ['Rec: bathroom', 'For a bathroom you want privacy without making it dark. A semi-opaque fabric like [Daylight Weave roller] does exactly that.'],
    ['Ballpark heads-up', 'Heads up so there are no surprises: $95 is our smallest roller. A [type] for a window your size usually runs about [$X–$Y — TBD]. I\'ll give you the exact price once we measure.'],
  ] },
  { id: 'measure', title: 'Measuring', stages: ['swatches', 'measuring'], items: [
    ['Send the form', "Here's a quick guide that walks you through measuring your [room] window, one step at a time: [measure link] When you hit send it comes right back to me, and I'll check every number."],
    ['Set up', "Great, let's measure! You'll need a metal tape measure (not a sewing tape). Takes about 10 minutes for [n] windows. Ready?"],
    ['Inside or outside', 'First choice: inside the window frame (clean, built-in look) or on the wall above it (blocks more light, makes the window look bigger)?'],
    ['Inside: width', 'Step 1, width: measure inside the frame, side to side, at the top, middle and bottom. Text me all three, to the nearest 1/8".'],
    ['Inside: height', 'Step 2, height: measure from the top inside of the frame down to the sill, on the left, middle and right. Text me all three.'],
    ['Inside: depth', 'Step 3, depth: how deep is the frame, from the glass (or window crank) out to the front edge?'],
    ['Tape photo', 'Last thing: a photo of the tape in place for one width and one height. That\'s how I double-check it for your fit guarantee.'],
    ["Don't subtract", "Don't subtract anything. I take care of the deductions."],
    ['Outside: width', 'Step 1: measure the width of the outside of the frame (trim to trim). Text it to me.'],
    ['Outside: height', 'Step 2: measure from where you want the top of the shade (usually 3–4" above the frame) down to the sill, or to where you want it to end.'],
  ] },
  { id: 'check', title: "Dana's check", stages: ['measuring', 'ready_to_quote'], items: [
    ['Read back', '[readback]'],
    ['Re-measure one', 'One quick check: [window] came out a bit wider than [other window]. Mind re-measuring the width on that one? Want to make sure it\'s perfect.'],
    ['Missing photo', 'Got the numbers, thank you! Can you send a close-up of a top corner with the tape showing the depth? That\'s the one I need for your fit guarantee.'],
    ['Did you deduct?', 'Did you take anything off these numbers? I just need the exact opening, wall to wall. I make the adjustments.'],
    ['All good', "Your measurements look great. I've checked them, so you're covered: measure wrong and we remake it free (one remake per shade, within 30 days of delivery). Putting your quote together now."],
  ] },
  { id: 'quote', title: 'Quote & price', stages: ['ready_to_quote', 'quoted'], items: [
    ['Send quote link', "Here's your quote, [name]: [quote link] Measurements checked, so the fit guarantee applies. Want me to lock it in?"],
    ['Quote as text', '[quote text]'],
    ['Why not $95?', "Fair question! $95 is our smallest standard roller. Yours is a [size] [type] in [fabric], and the size and [fabric/lining/fold] are what bring it to $[ ]. Every shade is cut to your exact window."],
    ['More than expected', 'Totally get it. Thanks for telling me. Want me to show you a couple of ways to bring it down? Same look, different trade-offs.'],
    ['Can you do better?', "I keep prices the same for everyone, so I can't knock it down. But I can get you to a lower number: [lever]. That brings it to $[ ]."],
    ['Amazon is cheaper', "For stock sizes they can be, and for a rental that might be the right call, honestly. Ours are cut to your exact window, and I check your measurements myself so the fit is guaranteed. If it doesn't fit, we remake it. Stock shades usually leave gaps or need trimming."],
  ] },
  { id: 'close', title: 'Close & pay', stages: ['quoted', 'paid'], items: [
    ['Lock it in', 'Want me to lock this in? Once you pay, it goes into production and ships in 2–4 weeks.'],
    ['Anything to change', 'Anything you want to change before I send it to production, like fabric, color or a window?'],
    ['Order confirmed', "You're all set! Order #[#] for [n] shades is in. I'll text you when it ships. Thank you, [name]!"],
  ] },
  { id: 'after', title: 'After the order', stages: ['paid', 'ordered', 'shipped', 'delivered', 'review_asked'], items: [
    ['In production', 'Your [room] shades are being made! Still on track to ship by [date].'],
    ['Shipped', "They're on the way! Tracking: [link]."],
    ['Delivered', "Your shades should be there! Here's a quick install guide: [link — TBD]. Any handyman can do it in about 15–20 min a shade. Text me with any questions."],
    ['A week later', "How do the [room] shades look? I'd love a photo if you're up for it."],
  ] },
  { id: 'follow', title: 'Follow-ups (max 3)', stages: [], items: [
    ['Nudge 1 (next day)', 'Hi [name]! Still thinking about the [fabric] [type] for your [room]? Happy to answer anything, or send swatches if that helps decide.'],
    ['Nudge 2 (3 days)', "Quick idea for your [room]: outside mount above the frame makes the window look taller. Want me to price it both ways?"],
    ['Nudge 3 (7 days)', "I don't want to bug you, so this is my last text. Your design is saved here: [look link] Whenever you're ready, just reply and I'll pick right up."],
  ] },
  { id: 'obj', title: 'Objections', stages: [], items: [
    ['Do you install?', "We don't install, but it's easy: two brackets, a few screws, a drill. Most people do it in 15–20 min a shade, and any handyman can too. I'll send you a how-to when they arrive."],
    ['Scared to measure', "Totally normal, and it's exactly why I'm here. I walk you through it one step at a time, then I check every number and photo. If I've checked it and it doesn't fit, we remake it."],
    ['Spouse needs to see', 'Of course! Here\'s your design to forward to whoever gets a vote: [look link]'],
    ['Returns', "Because each shade is made for your exact window, we can't take returns for a change of mind. That's why I send swatches and check your measurements: and if you measured wrong, we remake it free (one remake per shade, within 30 days of delivery). Defects and shipping damage are covered too."],
    ['Just looking', "No rush at all. Want me to mail swatches so you have them when you're ready? Otherwise I'll be here."],
  ] },
];

// ctx: {name, room, fabric, color, type, look, measure, quote, quoteText, readback, n}
export function fill(text, c) {
  let t = text;
  const name = c.name || '';
  t = t.replace(/^Hi \[name\]!/, name ? `Hi ${name}!` : 'Hi!')
       .replace(/, \[name\]([:!.])/g, name ? `, ${name}$1` : '$1')
       .replace(/\[name\]/g, name || '[name]');
  const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
  const map = { room: c.room, Room: cap(c.room), fabric: c.fabric, Fabric: cap(c.fabric), color: c.color, type: c.type,
    'look link': c.look, 'measure link': c.measure, 'quote link': c.quote, 'quote text': c.quoteText, readback: c.readback, n: c.n };
  return t.replace(/\[([^\]]+)\]/g, (m, k) => (map[k] ? map[k] : m));
}
