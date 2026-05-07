# Flat Skill View Scope

Assignment 00010 added `specdev skills view <name> [relative-path]`. Folder skills are scoped to their own directory, but flat markdown skills use the parent category directory as their base because they do not have a dedicated skill folder.

This is acceptable for now because `.specdev/skills/` is read-only workflow content, but future hardening could restrict flat markdown skills to their own markdown file and reject support-file paths.
