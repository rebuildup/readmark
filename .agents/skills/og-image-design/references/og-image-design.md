# OG Image Design References

Last reviewed: 2026-09-15

URL preview は protocol が image を提供しても、最終 card は consumer が組み立てる。以下を比較し、特定 platform の canvas / crop / chrome を universal rule にしない。

## Protocol / metadata model

- [The Open Graph protocol](https://ogp.me/)
  - Observe: `og:title`, `og:image`, `og:url`, description/site/locale と image structured properties の分離。
  - Useful for: page/object truth と preview metadata の ownership を理解する。
  - Avoid copying: example image dimensions や一つの implementation を visual rule にしない。

## Actual preview consumers

- [LinkedIn Help — Share articles or links](https://www.linkedin.com/help/recruiter/answer/a525301)
  - Observe: URL から image/title preview が組み立てられること、consumer 固有の frame/crop guidance。
  - Useful for: social-feed context と image + surrounding post/card の関係。
  - Avoid copying: LinkedIn の推奨比率を全 consumer の universal canvas にしない。

- [LinkedIn Help — Use Post Inspector to refresh URL](https://www.linkedin.com/help/linkedin/answer/a6233775)
  - Observe: cached preview image と refresh 後の新規 share の差。
  - Useful for: delivered preview verification / cache freshness。
  - Avoid copying: refresh 操作を design source of truth にしない。

- [Slack — Unfurling links in messages](https://api.slack.com/reference/messaging/link-unfurling)
  - Observe: classic unfurl が Open Graph / X Card metadata を読み、message context 内に preview を構成すること。
  - Useful for: collaboration/message surface と social feed の差、metadata complementarity。
  - Avoid copying: Slack Block Kit / API structure を OG image layout に変換しない。

- [Slack — Robots](https://api.slack.com/robots)
  - Observe: LinkExpanding crawler が meta tags と referenced media を取得・検査すること。
  - Useful for: crawler fetchability を final-artifact gate に含める根拠。
  - Avoid copying: crawler implementation details を visual recipe にしない。

- [Discord — About Link Previews and the Discordbot](https://support.discord.com/hc/en-us/articles/42500550752919-About-Discord-Link-Previews-and-the-Discordbot)
  - Observe: 2026-08 current behaviorとして、共有時に title / description / image を取得して chat preview を構成し、media を一時 cache し得ること。
  - Useful for: messaging preview、cache、consumer-controlled card behavior。
  - Avoid copying: Discord card appearance を画像自体へ焼き込まない。

## Production / implementation evidence

- [GitHub Docs — Customizing a repository social media preview](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/customizing-your-repositorys-social-media-preview)
  - Observe: repository identity を cross-platform preview image に持たせる用途、transparent image と dark-mode surroundings の trade-off。
  - Useful for: project/repository preview、background robustness。
  - Avoid copying: GitHub の推奨 dimensions/file limits を一般的な composition law にしない。

- [Next.js — Adding metadata](https://nextjs.org/learn/dashboard-app/adding-metadata)
  - Observe: static Open Graph image と dynamic image generation が同じ metadata responsibility を実装できること。
  - Useful for: default vs page-specific/generated family の implementation evidence。
  - Avoid copying: file convention / `ImageResponse` を design policy にしない。

- [Cloudflare Browser Run — Generate OG images for Astro sites](https://developers.cloudflare.com/browser-run/how-to/og-images-astro/)
  - Observe: template page → screenshot → crawler-served PNG という generated preview pipeline。
  - Useful for: generated family でも最終 raster と crawler delivery の両方を検証すべきこと。
  - Avoid copying: Astro/Browser Run の手順や template values を universal rule にしない。

## Comparison prompts

reference を比較するときは次を問う。

- consumer は image 以外に title / description / site identity の何を表示するか。
- image がなくても card は成立するか。image があることで何が増えるか。
- crop / reduction / surrounding UI が変わっても focal proposition は残るか。
- page-specific identity は site-level branding とどう共存するか。
- generated family の variation が増えたとき、どこから fallback へ切り替えるべきか。
- cache / crawler failure を含めて、作者が見ている source と利用者が見る preview が一致しているか。