alter table documents
  drop constraint documents_status_check;

alter table documents
  add constraint documents_status_check
  check (status in ('draft', 'issued', 'sent', 'paid', 'cancelled'));
