"""
DDLJ Trading System — Database CRUD Tests
============================================
Tests all CRUD operations using in-memory SQLite.
"""

import pytest
from datetime import datetime

import pytz
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import StaticPool

# Ensure backend is on path
import sys
from pathlib import Path
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from database.models import Base, Trade, Position, Session, ConfigOverride, TokenLog, ErrorLog

IST = pytz.timezone("Asia/Kolkata")


@pytest.fixture
async def db_session():
    """Create an in-memory SQLite database session for testing."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as session:
        yield session

    await engine.dispose()


class TestTradeCRUD:
    """Tests for Trade CRUD operations."""

    async def test_create_trade(self, db_session):
        """Test creating a trade record."""
        from database.crud import create_trade

        trade = await create_trade(
            db_session,
            session_id="session_20260430_091500",
            symbol="BANKNIFTY",
            direction="LONG",
            entry_price=53000.0,
            exit_price=53250.0,
            entry_time=datetime.now(IST),
            exit_time=datetime.now(IST),
            sl=52700.0,
            target=53500.0,
            qty=30,
            gross_pnl=7500.0,
            costs=180.0,
            net_pnl=7320.0,
            exit_reason="TARGET",
            rr=2.5,
            mode="options",
            option_strike=53100.0,
            option_type="CE",
            option_entry_premium=250.0,
            option_exit_premium=350.0,
            option_delta=0.55,
            option_iv_entry=16.5,
        )
        await db_session.commit()

        assert trade.id is not None
        assert trade.symbol == "BANKNIFTY"
        assert trade.direction == "LONG"
        assert trade.net_pnl == 7320.0
        assert trade.option_type == "CE"

    async def test_get_trades(self, db_session):
        """Test retrieving trades."""
        from database.crud import create_trade, get_trades

        # Create 3 trades
        for i in range(3):
            await create_trade(
                db_session,
                session_id="session_20260430_091500",
                symbol="BANKNIFTY",
                direction="LONG" if i % 2 == 0 else "SHORT",
                entry_price=53000.0 + i * 100,
                exit_price=53250.0 + i * 100,
                entry_time=datetime.now(IST),
                exit_time=datetime.now(IST),
                sl=52700.0,
                target=53500.0,
                qty=30,
                gross_pnl=7500.0 if i % 2 == 0 else -3000.0,
                costs=180.0,
                net_pnl=7320.0 if i % 2 == 0 else -3180.0,
                exit_reason="TARGET" if i % 2 == 0 else "SL",
                rr=2.5 if i % 2 == 0 else 0.0,
                mode="options",
            )
        await db_session.commit()

        trades = await get_trades(db_session, limit=10)
        assert len(trades) == 3

    async def test_get_trades_pagination(self, db_session):
        """Test trade pagination."""
        from database.crud import create_trade, get_trades

        for i in range(5):
            await create_trade(
                db_session,
                session_id="session_20260430_091500",
                symbol="NIFTY",
                direction="LONG",
                entry_price=24500.0,
                exit_price=24600.0,
                entry_time=datetime.now(IST),
                exit_time=datetime.now(IST),
                sl=24400.0,
                target=24700.0,
                qty=65,
                gross_pnl=6500.0,
                costs=200.0,
                net_pnl=6300.0,
                exit_reason="TARGET",
                rr=2.0,
            )
        await db_session.commit()

        page1 = await get_trades(db_session, limit=2, offset=0)
        page2 = await get_trades(db_session, limit=2, offset=2)
        assert len(page1) == 2
        assert len(page2) == 2

    async def test_get_trades_by_session(self, db_session):
        """Test retrieving trades filtered by session."""
        from database.crud import create_trade, get_trades_by_session

        # Create trades in two different sessions
        await create_trade(
            db_session,
            session_id="session_A",
            symbol="BANKNIFTY",
            direction="LONG",
            entry_price=53000.0,
            exit_price=53250.0,
            entry_time=datetime.now(IST),
            exit_time=datetime.now(IST),
            sl=52700.0,
            target=53500.0,
            qty=30,
            gross_pnl=7500.0,
            costs=180.0,
            net_pnl=7320.0,
            exit_reason="TARGET",
            rr=2.5,
        )
        await create_trade(
            db_session,
            session_id="session_B",
            symbol="NIFTY",
            direction="SHORT",
            entry_price=24500.0,
            exit_price=24400.0,
            entry_time=datetime.now(IST),
            exit_time=datetime.now(IST),
            sl=24600.0,
            target=24300.0,
            qty=65,
            gross_pnl=6500.0,
            costs=200.0,
            net_pnl=6300.0,
            exit_reason="TARGET",
            rr=2.0,
        )
        await db_session.commit()

        trades_a = await get_trades_by_session(db_session, "session_A")
        assert len(trades_a) == 1
        assert trades_a[0].symbol == "BANKNIFTY"

        trades_b = await get_trades_by_session(db_session, "session_B")
        assert len(trades_b) == 1
        assert trades_b[0].symbol == "NIFTY"

    async def test_count_trades(self, db_session):
        """Test counting trades."""
        from database.crud import create_trade, count_trades

        for i in range(3):
            await create_trade(
                db_session,
                session_id="session_20260430_091500",
                symbol="BANKNIFTY",
                direction="LONG",
                entry_price=53000.0,
                exit_price=53100.0,
                entry_time=datetime.now(IST),
                exit_time=datetime.now(IST),
                sl=52700.0,
                target=53500.0,
                qty=30,
                gross_pnl=3000.0,
                costs=100.0,
                net_pnl=2900.0,
                exit_reason="TARGET",
                rr=2.0,
            )
        await db_session.commit()

        total = await count_trades(db_session)
        assert total == 3

        by_session = await count_trades(db_session, session_id="session_20260430_091500")
        assert by_session == 3


class TestPositionCRUD:
    """Tests for Position CRUD operations."""

    async def test_create_position(self, db_session):
        """Test creating a position."""
        from database.crud import create_position

        pos = await create_position(
            db_session,
            session_id="session_20260430_091500",
            symbol="BANKNIFTY",
            direction="LONG",
            entry_price=53000.0,
            entry_time=datetime.now(IST),
            qty=30,
            sl=52700.0,
            target=53500.0,
            rr=2.5,
            atr_at_entry=265.0,
        )
        await db_session.commit()

        assert pos.id is not None
        assert pos.status == "open"
        assert pos.original_sl == 52700.0  # Should default to sl

    async def test_close_position(self, db_session):
        """Test closing a position."""
        from database.crud import create_position, close_position, get_open_positions

        pos = await create_position(
            db_session,
            session_id="session_20260430_091500",
            symbol="BANKNIFTY",
            direction="LONG",
            entry_price=53000.0,
            entry_time=datetime.now(IST),
            qty=30,
            sl=52700.0,
            target=53500.0,
            rr=2.5,
        )
        await db_session.commit()

        closed = await close_position(db_session, pos.id, status="closed")
        await db_session.commit()

        assert closed.status == "closed"

        # Verify it's no longer in open positions
        open_pos = await get_open_positions(db_session)
        assert len(open_pos) == 0

    async def test_get_open_positions(self, db_session):
        """Test getting only open positions."""
        from database.crud import create_position, close_position, get_open_positions

        # Create 2 open and 1 closed
        pos1 = await create_position(
            db_session, session_id="s1", symbol="BANKNIFTY", direction="LONG",
            entry_price=53000.0, entry_time=datetime.now(IST), qty=30,
            sl=52700.0, target=53500.0, rr=2.5,
        )
        pos2 = await create_position(
            db_session, session_id="s1", symbol="NIFTY", direction="SHORT",
            entry_price=24500.0, entry_time=datetime.now(IST), qty=65,
            sl=24600.0, target=24300.0, rr=1.5,
        )
        await db_session.commit()

        await close_position(db_session, pos1.id, status="closed")
        await db_session.commit()

        open_pos = await get_open_positions(db_session)
        assert len(open_pos) == 1
        assert open_pos[0].symbol == "NIFTY"

    async def test_get_open_positions_by_session(self, db_session):
        """Test filtering open positions by session."""
        from database.crud import create_position, get_open_positions

        await create_position(
            db_session, session_id="session_alpha", symbol="BANKNIFTY", direction="LONG",
            entry_price=53000.0, entry_time=datetime.now(IST), qty=30,
            sl=52700.0, target=53500.0, rr=2.5,
        )
        await create_position(
            db_session, session_id="session_beta", symbol="NIFTY", direction="SHORT",
            entry_price=24500.0, entry_time=datetime.now(IST), qty=65,
            sl=24600.0, target=24300.0, rr=1.5,
        )
        await db_session.commit()

        alpha = await get_open_positions(db_session, session_id="session_alpha")
        assert len(alpha) == 1
        assert alpha[0].symbol == "BANKNIFTY"

    async def test_count_open_positions(self, db_session):
        """Test counting open positions."""
        from database.crud import create_position, count_open_positions

        await create_position(
            db_session, session_id="s1", symbol="BANKNIFTY", direction="LONG",
            entry_price=53000.0, entry_time=datetime.now(IST), qty=30,
            sl=52700.0, target=53500.0, rr=2.5,
        )
        await db_session.commit()

        count = await count_open_positions(db_session)
        assert count == 1


class TestSessionCRUD:
    """Tests for Session CRUD operations."""

    async def test_create_session(self, db_session):
        """Test creating a trading session."""
        from database.crud import create_session

        session = await create_session(
            db_session,
            session_id="session_20260430_091500",
            start_time=datetime.now(IST),
            starting_capital=50000.0,
            config_json='{"DAILY_RISK_PCT": 6.0}',
        )
        await db_session.commit()

        assert session.id is not None
        assert session.status == "active"
        assert session.total_trades == 0

    async def test_close_session(self, db_session):
        """Test closing a trading session."""
        from database.crud import create_session, close_session

        session = await create_session(
            db_session,
            session_id="session_20260430_091500",
            start_time=datetime.now(IST),
            starting_capital=50000.0,
            config_json='{}',
        )
        await db_session.commit()

        closed = await close_session(
            db_session,
            "session_20260430_091500",
            ending_capital=55000.0,
            total_trades=5,
            total_pnl=5000.0,
        )
        await db_session.commit()

        assert closed.status == "closed"
        assert closed.ending_capital == 55000.0

    async def test_get_active_session(self, db_session):
        """Test getting the active session."""
        from database.crud import create_session, get_active_session

        # No active session initially
        assert await get_active_session(db_session) is None

        # Create one
        await create_session(
            db_session,
            session_id="session_20260430_091500",
            start_time=datetime.now(IST),
            starting_capital=50000.0,
            config_json='{}',
        )
        await db_session.commit()

        active = await get_active_session(db_session)
        assert active is not None
        assert active.session_id == "session_20260430_091500"

    async def test_get_sessions(self, db_session):
        """Test listing sessions with pagination."""
        from database.crud import create_session, get_sessions

        for i in range(3):
            await create_session(
                db_session,
                session_id=f"session_{i}",
                start_time=datetime.now(IST),
                starting_capital=50000.0 + i * 1000,
                config_json='{}',
            )
        await db_session.commit()

        all_sessions = await get_sessions(db_session, limit=10)
        assert len(all_sessions) == 3

        page = await get_sessions(db_session, limit=2, offset=0)
        assert len(page) == 2


class TestErrorLogCRUD:
    """Tests for ErrorLog CRUD operations."""

    async def test_log_and_get_errors(self, db_session):
        """Test logging and retrieving errors."""
        from database.crud import log_error, get_errors

        await log_error(
            db_session,
            error_type="TokenExpiredError",
            error_message="Kite token expired",
            module="token_manager",
            severity="critical",
        )
        await log_error(
            db_session,
            error_type="ConnectionError",
            error_message="API timeout",
            module="data_fetcher",
            severity="warning",
        )
        await db_session.commit()

        all_errors = await get_errors(db_session, limit=10)
        assert len(all_errors) == 2

        critical = await get_errors(db_session, severity="critical")
        assert len(critical) == 1

        warnings = await get_errors(db_session, severity="warning")
        assert len(warnings) == 1

    async def test_resolve_error(self, db_session):
        """Test resolving an error."""
        from database.crud import log_error, resolve_error

        err = await log_error(
            db_session,
            error_type="TestError",
            error_message="test",
            severity="error",
        )
        await db_session.commit()

        assert err.resolved is False

        resolved = await resolve_error(db_session, err.id)
        await db_session.commit()

        assert resolved is not None
        assert resolved.resolved is True

    async def test_count_unresolved_errors(self, db_session):
        """Test counting unresolved errors."""
        from database.crud import log_error, count_unresolved_errors

        await log_error(db_session, error_type="Err1", error_message="e1", severity="error")
        await log_error(db_session, error_type="Err2", error_message="e2", severity="warning")
        await db_session.commit()

        count = await count_unresolved_errors(db_session)
        assert count == 2


class TestConfigOverrideCRUD:
    """Tests for ConfigOverride CRUD operations."""

    async def test_save_and_get_overrides(self, db_session):
        """Test saving and retrieving config overrides."""
        from database.crud import save_config_override, get_config_overrides

        await save_config_override(db_session, key="DAILY_RISK_PCT", value="4.0", updated_by="user")
        await save_config_override(db_session, key="MAX_OPEN_POSITIONS", value="3", updated_by="user")
        await db_session.commit()

        overrides = await get_config_overrides(db_session)
        assert len(overrides) == 2

        # Update existing
        await save_config_override(db_session, key="DAILY_RISK_PCT", value="3.0", updated_by="system")
        await db_session.commit()

        overrides = await get_config_overrides(db_session)
        assert len(overrides) == 2  # Still 2, not 3
        risk = [o for o in overrides if o.key == "DAILY_RISK_PCT"][0]
        assert risk.value == "3.0"


class TestTokenLogCRUD:
    """Tests for TokenLog CRUD operations."""

    async def test_log_token_exchange(self, db_session):
        """Test logging token exchange attempts."""
        from database.crud import log_token_exchange, get_token_log

        await log_token_exchange(
            db_session,
            request_token="req_abc123",
            access_token="abcd...xyz1",
            user_name="test_user",
            status="success",
        )
        await log_token_exchange(
            db_session,
            request_token="req_bad",
            status="failed",
            error_message="Invalid request token",
        )
        await db_session.commit()

        logs = await get_token_log(db_session, limit=10)
        assert len(logs) == 2

    async def test_token_log_success_has_no_error(self, db_session):
        """Test that successful token log has no error_message."""
        from database.crud import log_token_exchange, get_token_log

        await log_token_exchange(
            db_session,
            request_token="req_ok",
            access_token="tok...1234",
            user_name="user1",
            status="success",
        )
        await db_session.commit()

        logs = await get_token_log(db_session, limit=10)
        assert len(logs) == 1
        assert logs[0].error_message is None
        assert logs[0].user_name == "user1"


class TestPnlSummary:
    """Tests for P&L summary helper."""

    async def test_empty_session_summary(self, db_session):
        """Test summary for session with no trades."""
        from database.crud import get_session_pnl_summary

        summary = await get_session_pnl_summary(db_session, "nonexistent_session")
        assert summary["total_trades"] == 0
        assert summary["win_rate"] == 0.0

    async def test_session_summary_with_trades(self, db_session):
        """Test summary for session with mixed trades."""
        from database.crud import create_trade, get_session_pnl_summary

        # Winning trade
        await create_trade(
            db_session,
            session_id="session_summary_test",
            symbol="BANKNIFTY",
            direction="LONG",
            entry_price=53000.0,
            exit_price=53250.0,
            entry_time=datetime.now(IST),
            exit_time=datetime.now(IST),
            sl=52700.0,
            target=53500.0,
            qty=30,
            gross_pnl=7500.0,
            costs=180.0,
            net_pnl=7320.0,
            exit_reason="TARGET",
            rr=2.5,
        )
        # Losing trade
        await create_trade(
            db_session,
            session_id="session_summary_test",
            symbol="NIFTY",
            direction="SHORT",
            entry_price=24500.0,
            exit_price=24600.0,
            entry_time=datetime.now(IST),
            exit_time=datetime.now(IST),
            sl=24400.0,
            target=24300.0,
            qty=65,
            gross_pnl=-6500.0,
            costs=200.0,
            net_pnl=-6700.0,
            exit_reason="SL",
            rr=0.0,
        )
        await db_session.commit()

        summary = await get_session_pnl_summary(db_session, "session_summary_test")
        assert summary["total_trades"] == 2
        assert summary["winning_trades"] == 1
        assert summary["losing_trades"] == 1
        assert summary["win_rate"] == 50.0
