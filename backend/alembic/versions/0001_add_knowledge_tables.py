"""create knowledge tables

Revision ID: 0001_add_knowledge_tables
Revises: 
Create Date: 2026-02-18 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0001_add_knowledge_tables'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'knowledge_identity',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('field_name', sa.String(length=128), nullable=False),
        sa.Column('field_value', sa.Text(), nullable=False),
        sa.Column('confidence', sa.Float(), nullable=False, server_default='0'),
        sa.Column('source', sa.String(length=50), nullable=False, server_default='onboarding'),
        sa.Column('last_updated', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_knowledge_identity_user_id', 'knowledge_identity', ['user_id'])
    op.create_index('ix_knowledge_identity_field_name', 'knowledge_identity', ['field_name'])

    op.create_table(
        'knowledge_goals',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('field_name', sa.String(length=128), nullable=False),
        sa.Column('field_value', sa.Text(), nullable=False),
        sa.Column('confidence', sa.Float(), nullable=False, server_default='0'),
        sa.Column('source', sa.String(length=50), nullable=False, server_default='onboarding'),
        sa.Column('last_updated', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_knowledge_goals_user_id', 'knowledge_goals', ['user_id'])
    op.create_index('ix_knowledge_goals_field_name', 'knowledge_goals', ['field_name'])

    op.create_table(
        'knowledge_projects',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('field_name', sa.String(length=128), nullable=False),
        sa.Column('field_value', sa.Text(), nullable=False),
        sa.Column('confidence', sa.Float(), nullable=False, server_default='0'),
        sa.Column('source', sa.String(length=50), nullable=False, server_default='onboarding'),
        sa.Column('last_updated', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_knowledge_projects_user_id', 'knowledge_projects', ['user_id'])
    op.create_index('ix_knowledge_projects_field_name', 'knowledge_projects', ['field_name'])

    op.create_table(
        'knowledge_finances',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('field_name', sa.String(length=128), nullable=False),
        sa.Column('field_value', sa.Text(), nullable=False),
        sa.Column('confidence', sa.Float(), nullable=False, server_default='0'),
        sa.Column('source', sa.String(length=50), nullable=False, server_default='onboarding'),
        sa.Column('last_updated', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_knowledge_finances_user_id', 'knowledge_finances', ['user_id'])
    op.create_index('ix_knowledge_finances_field_name', 'knowledge_finances', ['field_name'])

    op.create_table(
        'knowledge_relationships',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('field_name', sa.String(length=128), nullable=False),
        sa.Column('field_value', sa.Text(), nullable=False),
        sa.Column('confidence', sa.Float(), nullable=False, server_default='0'),
        sa.Column('source', sa.String(length=50), nullable=False, server_default='onboarding'),
        sa.Column('last_updated', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_knowledge_relationships_user_id', 'knowledge_relationships', ['user_id'])
    op.create_index('ix_knowledge_relationships_field_name', 'knowledge_relationships', ['field_name'])

    op.create_table(
        'knowledge_patterns',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('field_name', sa.String(length=128), nullable=False),
        sa.Column('field_value', sa.Text(), nullable=False),
        sa.Column('confidence', sa.Float(), nullable=False, server_default='0'),
        sa.Column('source', sa.String(length=50), nullable=False, server_default='analysis'),
        sa.Column('last_updated', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_knowledge_patterns_user_id', 'knowledge_patterns', ['user_id'])
    op.create_index('ix_knowledge_patterns_field_name', 'knowledge_patterns', ['field_name'])

    op.create_table(
        'knowledge_updates',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('conversation_id', sa.String(length=36), nullable=True),
        sa.Column('table_name', sa.String(length=64), nullable=False),
        sa.Column('field_name', sa.String(length=128), nullable=False),
        sa.Column('old_value', sa.Text(), nullable=True),
        sa.Column('new_value', sa.Text(), nullable=True),
        sa.Column('confidence', sa.Float(), nullable=False, server_default='0'),
        sa.Column('source', sa.String(length=50), nullable=False, server_default='system'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_knowledge_updates_user_id', 'knowledge_updates', ['user_id'])


def downgrade():
    op.drop_index('ix_knowledge_updates_user_id', table_name='knowledge_updates')
    op.drop_table('knowledge_updates')

    op.drop_index('ix_knowledge_patterns_field_name', table_name='knowledge_patterns')
    op.drop_index('ix_knowledge_patterns_user_id', table_name='knowledge_patterns')
    op.drop_table('knowledge_patterns')

    op.drop_index('ix_knowledge_relationships_field_name', table_name='knowledge_relationships')
    op.drop_index('ix_knowledge_relationships_user_id', table_name='knowledge_relationships')
    op.drop_table('knowledge_relationships')

    op.drop_index('ix_knowledge_finances_field_name', table_name='knowledge_finances')
    op.drop_index('ix_knowledge_finances_user_id', table_name='knowledge_finances')
    op.drop_table('knowledge_finances')

    op.drop_index('ix_knowledge_projects_field_name', table_name='knowledge_projects')
    op.drop_index('ix_knowledge_projects_user_id', table_name='knowledge_projects')
    op.drop_table('knowledge_projects')

    op.drop_index('ix_knowledge_goals_field_name', table_name='knowledge_goals')
    op.drop_index('ix_knowledge_goals_user_id', table_name='knowledge_goals')
    op.drop_table('knowledge_goals')

    op.drop_index('ix_knowledge_identity_field_name', table_name='knowledge_identity')
    op.drop_index('ix_knowledge_identity_user_id', table_name='knowledge_identity')
    op.drop_table('knowledge_identity')
