# CRO change log

Newest first. Each entry says which page changed, what we did, and why.

## 2026-11-18. A premium sticky add to cart bar

Page: product template `product.landing-01`. The new bar layout applies to every product page that has the sticky bar turned on.

The bar that slides up from the bottom once the buy box scrolls away was redesigned. It used to float as a rounded pill on desktop and show an icon-only button on phones. Now it runs the full width of the screen at every size. The reasoning is in [H8](test-hypotheses.md#h8-a-sticky-bar-that-reassures).

On phones it has three rows:

1. A trust line: "30-day guarantee", "Free shipping" and "Secure checkout", with small gold icons. On screens narrower than 360px the icons drop so the three points fit on one line.
2. A round product thumbnail, the product name in the serif heading font, the bundle chosen (for example "1 Stick"), a short rating ("★ 4.8 · 7k+ reviews"), and the price with the old price crossed out.
3. A full-width plum add to cart button that says "Add to cart".

On desktop it is one row: product and rating on the left, the trust points in a narrow column, then price and button.

We chose this layout from three prototypes (cream band, dark plum band, and this white sheet). The prototypes are kept on the `prototype/sticky-atc` branch.

How to change things in the theme editor: open the product section and turn on "Sticky add to cart bar". The new settings appear below it: show rating, rating, review count, three trust points (icon and text each), accent color for the star and icons, and button background and text. If either button color is empty, the bar uses the theme's primary button. Other product templates start with no trust points and no rating, so nothing appears there until it is filled in.

What to watch over the next two weeks: add to cart clicks that come from the sticky bar, and conversion rate on this page, compared with the two weeks before.

## 2026-11-18. A more premium look for the landing page

Page: product template `product.landing-01`, plus one store-wide font setting.

We made five small changes. None of them adds a step to the purchase or moves the buy box. The reasoning for each is in [H3 to H7](test-hypotheses.md#h3-serif-headings-in-sentence-case).

1. Headings use a serif font. The heading font in theme settings changed from Montserrat Bold to Cormorant Medium. The product title and every section heading on the page are larger and in normal capitalisation. Body text stays Montserrat. This setting is store-wide, so headings on other pages change too. [H3](test-hypotheses.md#h3-serif-headings-in-sentence-case)
2. The buy box text is lighter. The bundle names and prices went from bold to semibold. The benefit pills and the gift lines went from bold to medium. The "Black Friday sale" line is thinner with wider letter spacing. The sale bar and the add to cart button are now deep plum (#3B2A4A) instead of lilac and black. The button text reads "Add to cart" in normal capitalisation, and the button has fully rounded ends. [H4](test-hypotheses.md#h4-a-calmer-buy-box)
3. Trust badges sit under the add to cart button. Three short lines with gold line icons say "30-day money-back guarantee", "Free shipping on every order" and "Secure, encrypted checkout". Below them is a row of payment icons for PayPal, American Express, Apple Pay, Google Pay, Maestro, Mastercard, Visa and Shop Pay. The bordered guarantee box that sat in the same spot is turned off, because the first badge says the same thing. [H5](test-hypotheses.md#h5-trust-badges-under-the-button)
4. Reviews come second. The "Loved by thousands of women" section moved from fifth place to right after the "As seen on" logos. The logo strip lost its grey background and now has a thin line above and below. [H6](test-hypotheses.md#h6-reviews-before-claims)
5. A new section names four ingredients. "Skincare first, then coverage" sits after the five reasons and before the guarantee. It shows squalane, jojoba seed oil, shea butter and aloe vera, each with one line on what it does. All four are on the full ingredient list in the FAQ. [H7](test-hypotheses.md#h7-ingredient-spotlight)

The three "Shop now" buttons in the comparison, five reasons and guarantee sections are now outlined instead of filled, so the only filled button on the page is add to cart.

Before the real store launches, check the payment icons. They come from a list typed into the Trust badges block, not from the store's checkout settings. Every icon must be a method the real store accepts. Once the real store has its payment methods turned on, set the block's "Show" option to "Methods enabled in your store" and the icons will follow checkout automatically.

How to change things in the theme editor:

- The heading font is under Theme settings, Typography, Headings.
- The badge text, icons and payment list are in the Trust badges block inside the product section.
- The ingredients are blocks inside the Ingredient spotlight section. Each one has a number label, a name and a line of text.
- The outlined buttons use a new "Button style" setting on each of the three sections.
- The logo lines use a new "Show lines above and below" setting on the logo strip.

What to watch over the next two weeks: add to cart rate and conversion rate on this page, and how far down the page shoppers scroll, compared with the two weeks before.

## 2026-11-18. Star rating links to the reviews

Page: product template `product.landing-01`.

The star rating under the product title ("Excellent 4.8 | (7,295+ Reviews)") is now a link. The text is underlined so it looks clickable. Tapping it scrolls down to the "Loved by thousands of women" section.

Why: shoppers who see a review count want to read the reviews before they buy. Before this change the rating was plain text and the reviews sat several screens down, with nothing pointing to them. Now one tap takes them there.

To point the rating somewhere else, change the Link setting on the rating block in the theme editor. The reviews section has an Anchor ID setting, set to `reviews`, which is what `#reviews` jumps to.

## 2026-11-18. Buy box cleanup on landing-01

Page: product template `product.landing-01` (the Black Friday landing page).

We removed five items from the buy box.

1. The red "Hot product | Low stock" badge above the title.
2. The "Freya and 1M+ others purchased" line above the title.
3. The "This is NOT a subscription." note under the add to cart button.
4. The second Black Friday block below the add to cart button ("Selling fast" with an 87% bar and a countdown). The countdown above the bundle picker stays. The reasoning is in [H1](test-hypotheses.md#h1-one-black-friday-sale-block-instead-of-two).
5. The gift tiles below the add to cart button (free shipping, mystery gift and primer, locked until the 2 stick bundle is picked). The same three perks still show inside the 2 stick card. The reasoning is in [H2](test-hypotheses.md#h2-show-the-free-gifts-once-inside-the-bundle-card).

Why we removed them:

- The top of the buy box had four lines stacked before the product name. Shoppers now see the title and star rating first.
- "Low stock" and "1M+ others purchased" are fixed text. They don't come from real inventory or order data. Shoppers who see the same claim on every visit stop trusting it, and in the EU (we sell in German, French and Dutch) a false stock or popularity claim can break consumer protection law.
- The subscription note answered a question most shoppers don't have, right at the moment they click buy. Nothing on the page suggests a subscription. If support starts getting "am I being charged monthly?" tickets, we can bring it back, worded positively, for example "One-time purchase."

The block files (`landing-badge`, `landing-social-proof`) are still in the theme. They can be added back from the theme editor if we want to test them later.

What to watch over the next two weeks: add to cart rate and conversion rate on this page, compared with the two weeks before.
