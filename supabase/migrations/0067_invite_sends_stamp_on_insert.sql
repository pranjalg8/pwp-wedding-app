-- Review fix for 0065: stamp invite_sends.sent_by_uid only when a send is recorded. On UPDATE the trigger used to
-- overwrite it with whoever made the edit, which lost who recorded the send.
drop trigger invite_sends_stamp on invite_sends;
create trigger invite_sends_stamp before insert on invite_sends
  for each row execute function invite_sends_stamp();
