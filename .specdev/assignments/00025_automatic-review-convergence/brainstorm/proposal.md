# Proposal: Automatic review convergence

SpecDev currently applies a two-round ceiling to several review paths. That is
acceptable for a user-supervised Brainstorm, but it can halt a long-running
Assignment or Mission after the user has already approved its authority and
left the session unattended. Replace the shared ceiling with an explicit split:
interactive reviews return one verdict per user invocation, while automatic
reviews use a finite convergence and escalation policy.

The automatic policy gives the configured primary reviewer two guaranteed
rounds and a third only while the candidate is demonstrably changing. It then
uses one fresh resolver and one final arbitration review. The final result is
approval, an evidence-safe nonblocking override, or an explicit objective
failure routed through bounded Mission replanning or terminal failure. This
avoids both premature user waits and unlimited review loops.
