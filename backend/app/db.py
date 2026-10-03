from sqlmodel import Session, SQLModel, create_engine

DATABASE_URL = "sqlite:///ledger.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})


def create_db_and_tables() -> None:
    # Import models so their tables are registered on SQLModel.metadata.
    from app import models  # noqa: F401

    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
