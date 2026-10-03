"""Demo data: the Ledger story (see CLAUDE.md, phase B7).

Timeline: 2026-09-07 -> 2026-10-19 (6 weeks), checkpoints 0.33 / 0.66.
Group 7: Sam does nothing until just after 33% (private alert), then catches up
so the alert is resolved at 66%. Priya disputes a Jordan entry around t=0.45.
Group 3: Ben does nothing, so he is private at 33% and team at 66%.

All timestamps are fixed and the database is rebuilt first, so seeding twice
gives identical rows and ids.
"""

from datetime import datetime, timedelta, timezone

from sqlmodel import Session, SQLModel

from app import models  # noqa: F401  (registers tables for create_all)
from app.models import (
    Assignment, CharterItem, Document, Entry, Member, PasteEvent, Review, Team,
)
from app.services import clock

START = datetime(2026, 9, 7, tzinfo=timezone.utc)
DUE = datetime(2026, 10, 19, tzinfo=timezone.utc)
CHECKPOINTS = [0.33, 0.66]
JOIN_CODE = "ENGDES"
SEED_T = 0.20


def at_day(d: float) -> datetime:
    return START + timedelta(days=d)


def at_t(t: float) -> datetime:
    return START + (DUE - START) * t


def reset_db(session: Session) -> None:
    """Drop and recreate every table (ids restart at 1) and clear the demo clock."""
    session.commit()
    session.expunge_all()
    bind = session.get_bind()
    SQLModel.metadata.drop_all(bind)
    SQLModel.metadata.create_all(bind)
    clock.clear_override()


# (member, day, size, description, confirmers)  confirmers review at +4h, +9h, ...
GROUP7_ENTRIES = [
    ("Maya", 2, "M", "Collected 12 peer-reviewed sources on truss bridge design", ["Priya", "Jordan"]),
    ("Priya", 4, "M", "Cleaned the strain-gauge dataset from the lab session", ["Maya", "Jordan"]),
    ("Maya", 5, "L", "Annotated bibliography for sources 1-12", ["Priya", "Jordan"]),
    # Left pending (one confirm of two) so it can be confirmed live in the demo.
    ("Priya", 8, "S", "Removed outliers and documented the cleaning steps", ["Maya"]),
    ("Jordan", 9, "M", "Outline and structure for sections 1-3", ["Maya", "Priya"]),
    ("Maya", 10, "M", "Summarised load-testing standards for the methods section", ["Priya", "Jordan"]),
    ("Priya", 11, "M", "Load vs deflection charts for all three prototypes", ["Maya", "Jordan"]),
    ("Jordan", 12, "S", "Drafted the introduction paragraph", ["Maya", "Priya"]),
    ("Sam", 14.5, "M", "Background research on the history of truss bridges", ["Maya", "Priya"]),
    ("Jordan", 15, "L", "Section 1 draft: problem statement and design brief", ["Maya", "Priya"]),
    ("Maya", 16, "L", "Literature review draft: truss vs arch comparison", ["Priya", "Sam"]),
    ("Priya", 16, "L", "Regression analysis of deflection results", ["Maya", "Sam"]),
    ("Sam", 17, "L", "Background section: summary of truss design history", ["Maya", "Jordan"]),
    ("Priya", 21, "M", "Statistical comparison table for section 3", ["Maya", "Sam"]),
    ("Maya", 22, "M", "Fact-checked citations in sections 1-2", ["Priya", "Sam"]),
    ("Jordan", 22, "L", "Section 2 draft: design alternatives", ["Maya", "Sam"]),
    ("Sam", 24, "M", "Slide deck outline and storyboard", ["Priya", "Jordan"]),
    ("Priya", 25, "M", "Error bars and uncertainty analysis", ["Maya", "Jordan"]),
    ("Jordan", 26, "M", "Revised sections 1-2 after team feedback", ["Maya", "Priya"]),
    ("Sam", 26.5, "S", "Title and agenda slides", ["Maya", "Priya"]),
    ("Maya", 30, "S", "Formatted the reference list in APA 7", ["Priya", "Jordan"]),
    ("Jordan", 32, "L", "Section 3 conclusions and recommendations", ["Maya", "Sam"]),
    ("Priya", 34, "L", "Final chart pack for the presentation", ["Sam", "Jordan"]),
    ("Sam", 36, "L", "Built the full slide deck with Priya's charts", ["Priya", "Maya"]),
]

DISPUTED_DESCRIPTION = "Wrote section 3 analysis"
DISPUTE_NOTE = "The section 3 analysis was mine, Jordan formatted it."

GROUP3_ENTRIES = [
    ("Alex", 3, "M", "Introduction draft", ["Chloe"]),
    ("Chloe", 6, "S", "Set up the shared report template", ["Alex"]),
    ("Alex", 8, "L", "Literature review: eight sources summarised", ["Chloe"]),
    ("Chloe", 12, "M", "Plan for the discussion section", ["Alex"]),
    ("Alex", 18, "M", "Revised the literature review after feedback", ["Chloe"]),
    ("Chloe", 20, "M", "Discussion draft, part 1", ["Alex"]),
    ("Alex", 24, "L", "Final version of the introduction", ["Chloe"]),
    ("Chloe", 26, "M", "Discussion draft, part 2", ["Alex"]),
    ("Alex", 33, "M", "Abstract and executive summary", ["Chloe"]),
    ("Chloe", 35, "L", "Full edit pass for consistency and tone", ["Alex"]),
]

PASTED_TEXT = (
    "Truss bridges distribute loads through a framework of connected elements, typically "
    "arranged in triangular units. Because a triangle cannot change shape without changing "
    "the length of its sides, each member carries load primarily in tension or compression "
    "rather than bending. This makes trusses highly efficient for medium spans, where they "
    "achieve a high strength-to-weight ratio compared with solid beams. Common configurations "
    "include the Pratt truss, in which diagonal members slope towards the centre and carry "
    "tension, and the Warren truss, which uses equilateral triangles with alternating diagonal "
    "orientation. The Howe truss reverses the Pratt arrangement so that diagonals carry "
    "compression, a layout historically favoured for timber construction. Designers select a "
    "configuration based on span length, expected live loads, material availability, and "
    "fabrication cost, and must also consider fatigue at the joints, which are often the "
    "critical points for long-term durability and maintenance planning."
)[:900]


def _team(session, a, name, members, charter):
    team = Team(assignment_id=a.id, name=name)
    session.add(team)
    session.commit()
    ids = {}
    for n in members:
        m = Member(team_id=team.id, name=n)
        session.add(m)
        session.commit()
        ids[n] = m.id
    for n, responsibility, points, start, end in charter:
        session.add(CharterItem(team_id=team.id, member_id=ids[n], responsibility=responsibility,
                                planned_points=points, start_pct=start, end_pct=end))
    team.charter_locked = True
    session.add(team)
    session.commit()
    return team, ids


def _entries(session, team, ids, rows):
    created = {}
    for name, d, size, description, confirmers in rows:
        when = at_day(d)
        e = Entry(team_id=team.id, member_id=ids[name], description=description, size=size,
                  created_at=when)
        session.add(e)
        session.commit()
        for i, reviewer in enumerate(confirmers):
            session.add(Review(entry_id=e.id, reviewer_id=ids[reviewer], verdict="confirm",
                               created_at=when + timedelta(hours=4 + 5 * i)))
        created[description] = e
    session.commit()
    return created


def seed(session: Session) -> Assignment:
    reset_db(session)

    a = Assignment(title="Engineering Design Report", start_date=START, due_date=DUE,
                   join_code=JOIN_CODE, checkpoints=CHECKPOINTS)
    session.add(a)
    session.commit()

    # Group 7
    g7, g7_ids = _team(session, a, "Group 7", ["Maya", "Jordan", "Priya", "Sam"], [
        ("Maya", "Research and sources", 10, 0.0, 0.5),
        ("Jordan", "Writing sections 1-3", 12, 0.2, 0.9),
        ("Priya", "Data analysis and charts", 10, 0.1, 0.8),
        ("Sam", "Background research", 4, 0.0, 0.35),
        ("Sam", "Slides and presentation", 6, 0.6, 1.0),
    ])
    _entries(session, g7, g7_ids, GROUP7_ENTRIES)

    # Jordan's claim that Priya disputes around t=0.45 (Maya had already confirmed it).
    disputed = _entries(session, g7, g7_ids, [
        ("Jordan", 17, "L", DISPUTED_DESCRIPTION, ["Maya"]),
    ])[DISPUTED_DESCRIPTION]
    session.add(Review(entry_id=disputed.id, reviewer_id=g7_ids["Priya"], verdict="dispute",
                       note=DISPUTE_NOTE, created_at=at_t(0.45)))

    # Jordan's unlabelled 900-character paste around t=0.15.
    paste_at = at_t(0.15)
    session.add(PasteEvent(team_id=g7.id, member_id=g7_ids["Jordan"], kind="paste",
                           char_count=len(PASTED_TEXT), preview=PASTED_TEXT[:120],
                           is_internal=False, label=None, flagged=True, created_at=paste_at))
    session.add(Document(team_id=g7.id, content_html=f"<h1>Engineering Design Report</h1><p>{PASTED_TEXT}</p>",
                         content_text=f"Engineering Design Report\n{PASTED_TEXT}",
                         updated_at=paste_at, updated_by=g7_ids["Jordan"]))

    # Group 3
    g3, g3_ids = _team(session, a, "Group 3", ["Alex", "Ben", "Chloe"], [
        ("Alex", "Introduction and literature review", 8, 0.0, 0.6),
        ("Ben", "Methods and results", 8, 0.0, 0.7),
        ("Chloe", "Discussion and editing", 8, 0.1, 1.0),
    ])
    _entries(session, g3, g3_ids, GROUP3_ENTRIES)

    session.commit()
    session.refresh(a)
    clock.set_override(at_t(SEED_T))
    return a
