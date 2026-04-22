# Template Field Syntax

This document describes the syntax for defining field types and suggestion sources in template frontmatter.

## Overview

Fields are defined in YAML frontmatter using the `@type:` comment syntax:

```yaml
---
fieldname: defaultValue  # @type: type | source
---
```

The syntax has three parts:
1. **Field name and default value** - Standard YAML key-value
2. **Type** - The data type (`text`, `number`, `boolean`, `date`, `datetime`, `list`)
3. **Source** (optional) - Where to get suggestions from

## Types

### text

Plain text input. This is the default type.

```yaml
---
title: ""           # @type: text
description: ""     # @type: text
---
```

### number

Numeric values.

```yaml
---
estimate: 0         # @type: number
priority_score: 5   # @type: number
---
```

### boolean

True/false values. Suggests `true` and `false` options.

```yaml
---
completed: false    # @type: boolean
archived: false     # @type: boolean
---
```

### date

Date values in `YYYY-MM-DD` format. Shows relative date suggestions (today, tomorrow, next week, etc.).

```yaml
---
due: ""             # @type: date
created: ""         # @type: date
---
```

### datetime

Date and time values in `YYYY-MM-DDTHH:mm` format. Shows relative datetime suggestions.

```yaml
---
scheduled: ""       # @type: datetime
reminder: ""        # @type: datetime
---
```

### list

Multi-value field that outputs as a YAML array. Use this when you need to select multiple values.

```yaml
---
tags: []            # @type: list
attendees: []       # @type: list | tag:person
---
```

Output example:
```yaml
attendees:
  - "[[Alice]]"
  - "[[Bob]]"
```

## Sources

Sources define where suggestions come from. They are specified after the type using a pipe `|` delimiter.

### options

Fixed list of choices.

```yaml
---
priority: "medium"     # @type: text | options:high,medium,low
status: "To Do"        # @type: text | options:To Do,In Progress,Done
difficulty: ""         # @type: text | options:easy,medium,hard
---
```

For list fields with fixed options:

```yaml
---
tags: []               # @type: list | options:urgent,important,someday
categories: []         # @type: list | options:work,personal,hobby
---
```

### tag

Suggests notes that have a specific tag.

```yaml
---
assignee: ""           # @type: text | tag:person
project: ""            # @type: text | tag:project
client: ""             # @type: text | tag:client
---
```

For list fields:

```yaml
---
attendees: []          # @type: list | tag:person
related_projects: []   # @type: list | tag:project
---
```

The suggestions will be formatted as wikilinks: `[[NoteName]]`

### folder

Suggests notes from a specific folder.

```yaml
---
assignee: ""           # @type: text | folder:People/
project: ""            # @type: text | folder:Projects/
template: ""           # @type: text | folder:Templates/
---
```

For list fields:

```yaml
---
team_members: []       # @type: list | folder:People/Team/
resources: []          # @type: list | folder:Resources/
---
```

The suggestions will be formatted as wikilinks: `[[NoteName]]`

### field

Suggests values that already exist in your vault for a specific property. This is useful for maintaining consistency without defining a fixed list.

```yaml
---
status: ""             # @type: text | field:status
category: ""           # @type: text | field:category
author: ""             # @type: text | field:author
---
```

For example, if your vault has notes with these status values:
- Note1: `status: "To Do"`
- Note2: `status: "In Progress"`
- Note3: `status: "Done"`

The suggester will offer: `To Do`, `In Progress`, `Done`

## Type Inference

If no `@type:` hint is provided, the type is inferred from the default value:

| Default Value | Inferred Type |
|---------------|---------------|
| `true` / `false` | boolean |
| `42`, `3.14` | number |
| `2024-01-15` | date |
| `2024-01-15T10:30` | datetime |
| `[]` | list |
| anything else | text |

```yaml
---
# These are equivalent:
completed: false           # Inferred as boolean
completed: false           # @type: boolean

count: 42                  # Inferred as number
count: 42                  # @type: number

due: 2024-01-15            # Inferred as date
due: 2024-01-15            # @type: date
---
```

## Complete Examples

### Task Template

```yaml
---
title: ""                  # @type: text
status: "To Do"            # @type: text | options:To Do,In Progress,Blocked,Done
priority: "medium"         # @type: text | options:high,medium,low
due: ""                    # @type: date
assignee: ""               # @type: text | tag:person
project: ""                # @type: text | folder:Projects/
tags: []                   # @type: list | options:urgent,important,quick-win
completed: false           # @type: boolean
---
```

### Meeting Note Template

```yaml
---
title: ""                  # @type: text
date: ""                   # @type: date
time: ""                   # @type: datetime
attendees: []              # @type: list | tag:person
project: ""                # @type: text | folder:Projects/
type: "meeting"            # @type: text | options:meeting,standup,review,planning
action_items: []           # @type: list
---
```

### Person Template

```yaml
---
name: ""                   # @type: text
email: ""                  # @type: text
company: ""                # @type: text | field:company
role: ""                   # @type: text | field:role
team: ""                   # @type: text | folder:Teams/
tags: []                   # @type: list | options:colleague,client,partner
---
```

### Project Template

```yaml
---
name: ""                   # @type: text
status: "planning"         # @type: text | options:planning,active,on-hold,completed
owner: ""                  # @type: text | tag:person
team: []                   # @type: list | tag:person
start_date: ""             # @type: date
due_date: ""               # @type: date
priority: 3                # @type: number
archived: false            # @type: boolean
---
```
