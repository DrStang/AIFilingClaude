-- AI Filing Cabinet V2 Features Migration
-- Run this SQL in your Supabase SQL Editor after setup.sql

-- =====================================================
-- 1. FOLDERS - Hierarchical document organization
-- =====================================================

CREATE TABLE folders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  color TEXT DEFAULT '#6b7280',
  icon TEXT DEFAULT 'folder',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add folder reference to documents
ALTER TABLE documents ADD COLUMN folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;

-- Indexes for folders
CREATE INDEX idx_folders_user_id ON folders(user_id);
CREATE INDEX idx_folders_parent_id ON folders(parent_id);
CREATE INDEX idx_documents_folder_id ON documents(folder_id);

-- RLS for folders
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own folders"
  ON folders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own folders"
  ON folders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own folders"
  ON folders FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own folders"
  ON folders FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_folders_updated_at
  BEFORE UPDATE ON folders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 2. TAGS - Custom tagging system
-- =====================================================

CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Junction table for document-tag relationship
CREATE TABLE document_tags (
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (document_id, tag_id)
);

-- Indexes for tags
CREATE INDEX idx_tags_user_id ON tags(user_id);
CREATE INDEX idx_document_tags_document_id ON document_tags(document_id);
CREATE INDEX idx_document_tags_tag_id ON document_tags(tag_id);

-- RLS for tags
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tags"
  ON tags FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tags"
  ON tags FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tags"
  ON tags FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tags"
  ON tags FOR DELETE
  USING (auth.uid() = user_id);

-- Document tags policies (user must own the document)
CREATE POLICY "Users can view document tags for their documents"
  ON document_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM documents WHERE documents.id = document_tags.document_id
      AND documents.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add tags to their documents"
  ON document_tags FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents WHERE documents.id = document_tags.document_id
      AND documents.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can remove tags from their documents"
  ON document_tags FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM documents WHERE documents.id = document_tags.document_id
      AND documents.user_id = auth.uid()
    )
  );

-- =====================================================
-- 3. FAMILY SHARING - Share documents with family members
-- =====================================================

-- Family groups
CREATE TABLE family_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  invite_code TEXT UNIQUE DEFAULT encode(gen_random_bytes(6), 'hex'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Family members
CREATE TABLE family_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_group_id UUID REFERENCES family_groups(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(family_group_id, user_id)
);

-- Document shares (individual document sharing)
CREATE TABLE document_shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  shared_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  shared_with UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  family_group_id UUID REFERENCES family_groups(id) ON DELETE CASCADE,
  permission TEXT DEFAULT 'view' CHECK (permission IN ('view', 'edit')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT share_target CHECK (
    (shared_with IS NOT NULL AND family_group_id IS NULL) OR
    (shared_with IS NULL AND family_group_id IS NOT NULL)
  )
);

-- Folder shares (share entire folders)
CREATE TABLE folder_shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  folder_id UUID REFERENCES folders(id) ON DELETE CASCADE NOT NULL,
  shared_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  shared_with UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  family_group_id UUID REFERENCES family_groups(id) ON DELETE CASCADE,
  permission TEXT DEFAULT 'view' CHECK (permission IN ('view', 'edit')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT folder_share_target CHECK (
    (shared_with IS NOT NULL AND family_group_id IS NULL) OR
    (shared_with IS NULL AND family_group_id IS NOT NULL)
  )
);

-- Indexes for sharing
CREATE INDEX idx_family_groups_owner_id ON family_groups(owner_id);
CREATE INDEX idx_family_members_family_group_id ON family_members(family_group_id);
CREATE INDEX idx_family_members_user_id ON family_members(user_id);
CREATE INDEX idx_document_shares_document_id ON document_shares(document_id);
CREATE INDEX idx_document_shares_shared_with ON document_shares(shared_with);
CREATE INDEX idx_document_shares_family_group_id ON document_shares(family_group_id);
CREATE INDEX idx_folder_shares_folder_id ON folder_shares(folder_id);

-- RLS for sharing tables
ALTER TABLE family_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE folder_shares ENABLE ROW LEVEL SECURITY;

-- Family groups policies
CREATE POLICY "Users can view groups they belong to"
  ON family_groups FOR SELECT
  USING (
    owner_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM family_members
      WHERE family_members.family_group_id = family_groups.id
      AND family_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create family groups"
  ON family_groups FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update their family groups"
  ON family_groups FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can delete their family groups"
  ON family_groups FOR DELETE
  USING (auth.uid() = owner_id);

-- Family members policies
CREATE POLICY "Members can view their group members"
  ON family_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM family_members fm
      WHERE fm.family_group_id = family_members.family_group_id
      AND fm.user_id = auth.uid()
    )
  );

CREATE POLICY "Group owners/admins can add members"
  ON family_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM family_groups
      WHERE family_groups.id = family_members.family_group_id
      AND family_groups.owner_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM family_members fm
      WHERE fm.family_group_id = family_members.family_group_id
      AND fm.user_id = auth.uid()
      AND fm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Group owners can remove members"
  ON family_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM family_groups
      WHERE family_groups.id = family_members.family_group_id
      AND family_groups.owner_id = auth.uid()
    ) OR
    user_id = auth.uid()  -- Members can leave
  );

-- Document shares policies
CREATE POLICY "Users can view shares they created or received"
  ON document_shares FOR SELECT
  USING (
    shared_by = auth.uid() OR
    shared_with = auth.uid() OR
    EXISTS (
      SELECT 1 FROM family_members
      WHERE family_members.family_group_id = document_shares.family_group_id
      AND family_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Document owners can create shares"
  ON document_shares FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_shares.document_id
      AND documents.user_id = auth.uid()
    )
  );

CREATE POLICY "Document owners can delete shares"
  ON document_shares FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_shares.document_id
      AND documents.user_id = auth.uid()
    )
  );

-- Folder shares policies
CREATE POLICY "Users can view folder shares they created or received"
  ON folder_shares FOR SELECT
  USING (
    shared_by = auth.uid() OR
    shared_with = auth.uid() OR
    EXISTS (
      SELECT 1 FROM family_members
      WHERE family_members.family_group_id = folder_shares.family_group_id
      AND family_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Folder owners can create shares"
  ON folder_shares FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM folders
      WHERE folders.id = folder_shares.folder_id
      AND folders.user_id = auth.uid()
    )
  );

CREATE POLICY "Folder owners can delete shares"
  ON folder_shares FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM folders
      WHERE folders.id = folder_shares.folder_id
      AND folders.user_id = auth.uid()
    )
  );

-- =====================================================
-- 4. EMAIL IMPORTS - Track imported email attachments
-- =====================================================

CREATE TABLE email_imports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  email_subject TEXT,
  email_from TEXT,
  email_date TIMESTAMPTZ,
  attachment_name TEXT NOT NULL,
  import_source TEXT DEFAULT 'manual' CHECK (import_source IN ('manual', 'imap', 'webhook', 'forward')),
  processed BOOLEAN DEFAULT FALSE,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_imports_user_id ON email_imports(user_id);
CREATE INDEX idx_email_imports_document_id ON email_imports(document_id);
CREATE INDEX idx_email_imports_processed ON email_imports(processed);

ALTER TABLE email_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own email imports"
  ON email_imports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own email imports"
  ON email_imports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own email imports"
  ON email_imports FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own email imports"
  ON email_imports FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- 5. EXPORT HISTORY - Track document exports
-- =====================================================

CREATE TABLE export_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  export_type TEXT NOT NULL CHECK (export_type IN ('pdf', 'zip', 'csv')),
  document_ids UUID[] NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_export_history_user_id ON export_history(user_id);

ALTER TABLE export_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own export history"
  ON export_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own export history"
  ON export_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 6. UPDATE DOCUMENTS RLS FOR SHARING
-- =====================================================

-- Drop existing select policy and create new one that includes shared documents
DROP POLICY IF EXISTS "Users can view their own documents" ON documents;

CREATE POLICY "Users can view their own and shared documents"
  ON documents FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM document_shares
      WHERE document_shares.document_id = documents.id
      AND (
        document_shares.shared_with = auth.uid() OR
        EXISTS (
          SELECT 1 FROM family_members
          WHERE family_members.family_group_id = document_shares.family_group_id
          AND family_members.user_id = auth.uid()
        )
      )
    ) OR
    EXISTS (
      SELECT 1 FROM folder_shares
      WHERE folder_shares.folder_id = documents.folder_id
      AND (
        folder_shares.shared_with = auth.uid() OR
        EXISTS (
          SELECT 1 FROM family_members
          WHERE family_members.family_group_id = folder_shares.family_group_id
          AND family_members.user_id = auth.uid()
        )
      )
    )
  );

-- =====================================================
-- 7. TRIGGERS FOR NEW TABLES
-- =====================================================

CREATE TRIGGER update_family_groups_updated_at
  BEFORE UPDATE ON family_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 8. HELPER FUNCTIONS
-- =====================================================

-- Function to check if user has edit access to a document
CREATE OR REPLACE FUNCTION user_can_edit_document(doc_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM documents WHERE id = doc_id AND user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM document_shares
    WHERE document_id = doc_id
    AND permission = 'edit'
    AND (
      shared_with = auth.uid() OR
      EXISTS (
        SELECT 1 FROM family_members
        WHERE family_members.family_group_id = document_shares.family_group_id
        AND family_members.user_id = auth.uid()
      )
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get folder path (breadcrumb)
CREATE OR REPLACE FUNCTION get_folder_path(folder_id UUID)
RETURNS TABLE (id UUID, name TEXT, depth INT) AS $$
WITH RECURSIVE folder_path AS (
  SELECT f.id, f.name, f.parent_id, 0 AS depth
  FROM folders f
  WHERE f.id = folder_id

  UNION ALL

  SELECT f.id, f.name, f.parent_id, fp.depth + 1
  FROM folders f
  JOIN folder_path fp ON f.id = fp.parent_id
)
SELECT fp.id, fp.name, fp.depth
FROM folder_path fp
ORDER BY fp.depth DESC;
$$ LANGUAGE sql STABLE;

COMMENT ON TABLE folders IS 'Hierarchical folder organization for documents';
COMMENT ON TABLE tags IS 'User-defined tags for document classification';
COMMENT ON TABLE document_tags IS 'Many-to-many relationship between documents and tags';
COMMENT ON TABLE family_groups IS 'Family sharing groups for collaborative document access';
COMMENT ON TABLE family_members IS 'Membership in family sharing groups';
COMMENT ON TABLE document_shares IS 'Individual document sharing permissions';
COMMENT ON TABLE folder_shares IS 'Folder-level sharing permissions';
COMMENT ON TABLE email_imports IS 'Tracking of email attachment imports';
COMMENT ON TABLE export_history IS 'History of document exports';
