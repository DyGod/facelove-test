# CRO change log

Newest first. Each entry says which page changed, what we did, and why.

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
