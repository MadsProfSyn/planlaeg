CREATE TRIGGER sync_inspection_flags
BEFORE INSERT OR UPDATE ON monday_items_selected
FOR EACH ROW
EXECUTE FUNCTION extract_inspection_flags();