# GraphQL Markdown Doc Generator

### Installation

- Download the latest release [here](https://github.com/luckymarmot/graphqldocs/releases).
- Go to `Paw > Preferences` or simply use the keyboard shortcut: <kbd>cmd</kbd> + <kbd>,</kbd>
- Click on the `Extensions tab > Open Directory`, extract the content of the zip file in that directory.
- You should see `GraphQLDocs Generator` listed.
- Create a new Request, and on the Generators dropdown, select GraphQLDocs

### Usage

- [See how to Export single Request](https://user-images.githubusercontent.com/962502/156818898-b12b4035-0543-4bbd-b7a2-76a538d8d377.png)
- [See how to Export multiple Request](https://user-images.githubusercontent.com/962502/156818991-fd2eb1d4-0865-4df8-9493-d9645c938cc2.png)

By default, GraphQLDocs will generate a markdown document based on the Request information
available. Basic Response information will only be available if there's at least one Http Exchange. It will
always render the latest exchange.

You may also customize the documentation output by using the comment tags on the
description textarea like so:

```markdown
### Request 101

This comment tag below will render the request's headers.

<!-- request:headers -->

This comment tag below will render the request's body

<!-- request:body -->

By appending `:collapsed` to the tag will wrap the code block with `<details> ... </details>` markup tag
which makes it collapsible when rendered in Github Markdown.
```

Here's a list of available comment tags:

```html
Request Headers
<!-- request:headers -->
or
<!-- request:headers:collapsed -->

Request URLParams
<!-- request:urlparams -->
or
<!-- request:urlparams:collapsed -->

Request Body
<!-- request:body -->
or
<!-- request:body:collapsed -->

Response Headers
<!-- response:headers -->
or
<!-- response:headers:collapsed -->

Response Body
<!-- response:body -->
or
<!-- response:body:collapsed -->
```
