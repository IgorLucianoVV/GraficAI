// Gerado por scripts/embed-migrations.mjs — não edite.
export const MIGRATIONS: { id: string; statements: string[] }[] = [
  {
    "id": "0000_even_naoko",
    "statements": [
      "CREATE TABLE \"design_templates\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"workspace_id\" uuid NOT NULL,\n\t\"name\" text NOT NULL,\n\t\"data\" jsonb NOT NULL,\n\t\"created_by\" uuid,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\t\"updated_at\" timestamp with time zone DEFAULT now() NOT NULL\n);",
      "CREATE TABLE \"invites\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"workspace_id\" uuid NOT NULL,\n\t\"token_hash\" text NOT NULL,\n\t\"role\" text NOT NULL,\n\t\"created_by\" uuid,\n\t\"expires_at\" timestamp with time zone NOT NULL,\n\t\"accepted_by\" uuid,\n\t\"accepted_at\" timestamp with time zone,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\tCONSTRAINT \"invites_token_hash_unique\" UNIQUE(\"token_hash\")\n);",
      "CREATE TABLE \"memberships\" (\n\t\"workspace_id\" uuid NOT NULL,\n\t\"user_id\" uuid NOT NULL,\n\t\"role\" text NOT NULL,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\tCONSTRAINT \"memberships_workspace_id_user_id_pk\" PRIMARY KEY(\"workspace_id\",\"user_id\")\n);",
      "CREATE TABLE \"printer_profiles\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"workspace_id\" uuid NOT NULL,\n\t\"name\" text NOT NULL,\n\t\"data\" jsonb NOT NULL,\n\t\"created_by\" uuid,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\t\"updated_at\" timestamp with time zone DEFAULT now() NOT NULL\n);",
      "CREATE TABLE \"project_versions\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"project_id\" uuid NOT NULL,\n\t\"label\" text NOT NULL,\n\t\"auto\" boolean DEFAULT false NOT NULL,\n\t\"revision\" integer NOT NULL,\n\t\"data\" jsonb NOT NULL,\n\t\"summary\" jsonb,\n\t\"created_by\" uuid,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL\n);",
      "CREATE TABLE \"projects\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"workspace_id\" uuid NOT NULL,\n\t\"title\" text NOT NULL,\n\t\"data\" jsonb NOT NULL,\n\t\"summary\" jsonb,\n\t\"revision\" integer DEFAULT 1 NOT NULL,\n\t\"created_by\" uuid,\n\t\"updated_by\" uuid,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\t\"updated_at\" timestamp with time zone DEFAULT now() NOT NULL\n);",
      "CREATE TABLE \"sessions\" (\n\t\"id\" text PRIMARY KEY NOT NULL,\n\t\"user_id\" uuid NOT NULL,\n\t\"expires_at\" timestamp with time zone NOT NULL,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL\n);",
      "CREATE TABLE \"users\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"email\" text NOT NULL,\n\t\"name\" text NOT NULL,\n\t\"password_hash\" text NOT NULL,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\tCONSTRAINT \"users_email_unique\" UNIQUE(\"email\")\n);",
      "CREATE TABLE \"workspaces\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"name\" text NOT NULL,\n\t\"personal\" boolean DEFAULT false NOT NULL,\n\t\"created_by\" uuid,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL\n);",
      "ALTER TABLE \"design_templates\" ADD CONSTRAINT \"design_templates_workspace_id_workspaces_id_fk\" FOREIGN KEY (\"workspace_id\") REFERENCES \"public\".\"workspaces\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"design_templates\" ADD CONSTRAINT \"design_templates_created_by_users_id_fk\" FOREIGN KEY (\"created_by\") REFERENCES \"public\".\"users\"(\"id\") ON DELETE set null ON UPDATE no action;",
      "ALTER TABLE \"invites\" ADD CONSTRAINT \"invites_workspace_id_workspaces_id_fk\" FOREIGN KEY (\"workspace_id\") REFERENCES \"public\".\"workspaces\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"invites\" ADD CONSTRAINT \"invites_created_by_users_id_fk\" FOREIGN KEY (\"created_by\") REFERENCES \"public\".\"users\"(\"id\") ON DELETE set null ON UPDATE no action;",
      "ALTER TABLE \"invites\" ADD CONSTRAINT \"invites_accepted_by_users_id_fk\" FOREIGN KEY (\"accepted_by\") REFERENCES \"public\".\"users\"(\"id\") ON DELETE set null ON UPDATE no action;",
      "ALTER TABLE \"memberships\" ADD CONSTRAINT \"memberships_workspace_id_workspaces_id_fk\" FOREIGN KEY (\"workspace_id\") REFERENCES \"public\".\"workspaces\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"memberships\" ADD CONSTRAINT \"memberships_user_id_users_id_fk\" FOREIGN KEY (\"user_id\") REFERENCES \"public\".\"users\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"printer_profiles\" ADD CONSTRAINT \"printer_profiles_workspace_id_workspaces_id_fk\" FOREIGN KEY (\"workspace_id\") REFERENCES \"public\".\"workspaces\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"printer_profiles\" ADD CONSTRAINT \"printer_profiles_created_by_users_id_fk\" FOREIGN KEY (\"created_by\") REFERENCES \"public\".\"users\"(\"id\") ON DELETE set null ON UPDATE no action;",
      "ALTER TABLE \"project_versions\" ADD CONSTRAINT \"project_versions_project_id_projects_id_fk\" FOREIGN KEY (\"project_id\") REFERENCES \"public\".\"projects\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"project_versions\" ADD CONSTRAINT \"project_versions_created_by_users_id_fk\" FOREIGN KEY (\"created_by\") REFERENCES \"public\".\"users\"(\"id\") ON DELETE set null ON UPDATE no action;",
      "ALTER TABLE \"projects\" ADD CONSTRAINT \"projects_workspace_id_workspaces_id_fk\" FOREIGN KEY (\"workspace_id\") REFERENCES \"public\".\"workspaces\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"projects\" ADD CONSTRAINT \"projects_created_by_users_id_fk\" FOREIGN KEY (\"created_by\") REFERENCES \"public\".\"users\"(\"id\") ON DELETE set null ON UPDATE no action;",
      "ALTER TABLE \"projects\" ADD CONSTRAINT \"projects_updated_by_users_id_fk\" FOREIGN KEY (\"updated_by\") REFERENCES \"public\".\"users\"(\"id\") ON DELETE set null ON UPDATE no action;",
      "ALTER TABLE \"sessions\" ADD CONSTRAINT \"sessions_user_id_users_id_fk\" FOREIGN KEY (\"user_id\") REFERENCES \"public\".\"users\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"workspaces\" ADD CONSTRAINT \"workspaces_created_by_users_id_fk\" FOREIGN KEY (\"created_by\") REFERENCES \"public\".\"users\"(\"id\") ON DELETE set null ON UPDATE no action;",
      "CREATE INDEX \"memberships_user_idx\" ON \"memberships\" USING btree (\"user_id\");",
      "CREATE INDEX \"versions_project_idx\" ON \"project_versions\" USING btree (\"project_id\",\"created_at\");",
      "CREATE INDEX \"projects_ws_idx\" ON \"projects\" USING btree (\"workspace_id\",\"updated_at\");",
      "CREATE INDEX \"sessions_user_idx\" ON \"sessions\" USING btree (\"user_id\");"
    ]
  }
];
