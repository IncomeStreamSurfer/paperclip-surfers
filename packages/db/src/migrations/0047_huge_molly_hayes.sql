-- Remove duplicate MCP server rows, keeping the most recently updated per (company_id, name)
DELETE FROM "company_mcp_servers"
WHERE "id" NOT IN (
  SELECT DISTINCT ON ("company_id", "name") "id"
  FROM "company_mcp_servers"
  ORDER BY "company_id", "name", "updated_at" DESC
);

CREATE UNIQUE INDEX "company_mcp_servers_company_name_uniq" ON "company_mcp_servers" USING btree ("company_id","name");
