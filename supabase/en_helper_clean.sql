-- EN Helper, part 3: nothing inappropriate is ever stored in a voice entry.
-- Run once in the Supabase SQL editor, after en_helper_complete.sql. Safe to
-- run twice.
--
-- A phone in a shop hears everyone, and speech-to-text writes down whatever it
-- hears, including someone swearing in the background. This is the last line:
-- every text a voice entry holds (the transcript, the AI's write-up, every
-- answer, every follow-up) passes through clean_notebook_text() on its way into
-- the table, whoever writes it: the speech model, the AI, or a student typing.
-- A match is taken out silently, with no marker: a "[removed]" in someone's
-- notebook tells everyone reading it that something was said, and a student
-- who didn't say it (it was someone nearby) shouldn't wear that.
--
-- The notebook-voice function also asks the AI to take out whole sentences
-- that are crude or inappropriate without using a listed word. That catches
-- more, but it's an AI; this list is the part that can't miss.
--
-- Words match whole words only (\m and \M), so "class", "assembly", "shell",
-- "cockpit" and "flame retardant" are untouched. Robotics words that look rude
-- out of context ("screw", "balls" as in ball bearings, "nuts") are left out
-- on purpose.

create or replace function public.clean_notebook_text(t text)
returns text
language sql
immutable
as $$
  select case when t is null then null else
    regexp_replace(t,
      '\m(' ||
        -- f-word and its family, including run-together forms
        '[a-z]*f+u+c+k+[a-z]*|f+u+k+|fk|fck[a-z]*|fuq[a-z]*|wtf|stfu|gtfo|' ||
        -- s-word
        '[a-z]*s+h+i+t+[a-z]*|bs|' ||
        -- a-word, standalone and compounds only
        'ass|asses|asshat[a-z]*|asshole[a-z]*|arse|arsehole[a-z]*|dumbass[a-z]*|jackass[a-z]*|smartass[a-z]*|badass|kickass|' ||
        'bitch[a-z]*|bastard[a-z]*|damn[a-z]*|goddamn[a-z]*|dammit|crap|crappy|crapped|hell|' ||
        'dick|dicks|dickhead[a-z]*|cock|cocks|cocksucker[a-z]*|pussy|pussies|cunt[a-z]*|twat[a-z]*|prick|pricks|' ||
        'slut[a-z]*|whore[a-z]*|hoe|hoes|thot|' ||
        'piss|pissed|pissing|pisses|' ||
        'porn[a-z]*|nude|nudes|sexy|horny|boner|blowjob[a-z]*|handjob[a-z]*|dildo[a-z]*|' ||
        -- slurs
        'fag|fags|faggot[a-z]*|nigg[a-z]*|retard|retards|retarded|tranny|trannies|spic|spics|chink|chinks|kike|kikes' ||
      ')(''[a-z]+)?\M',
      '', 'gi')
  end
$$;

-- The same, with the gap it leaves tidied: no doubled spaces, no space
-- before punctuation, no stray leading punctuation on a line. Newlines are
-- kept, because they separate a transcript's answers.
create or replace function public.clean_notebook_text_tidy(t text)
returns text
language sql
immutable
as $$
  select case when t is null then null else
    btrim(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
      public.clean_notebook_text(t),
      '\[removed\][ \t]*', '', 'g'),          -- markers left by the earlier version
      '([.!?;:,])([ \t]*[.!?;,])+', '\1', 'g'),  -- punctuation stranded by a removal
      '[ \t]{2,}', ' ', 'g'),
      '[ \t]+([,.!?;:])', '\1', 'g'),
      '(^|\n)[ \t]*[,.!?;:]+[ \t]*', '\1', 'g'), ' ')
  end
$$;

create or replace function public.notebook_voice_clean()
returns trigger
language plpgsql
as $$
begin
  if new.source = 'voice' then
    new.transcript      := public.clean_notebook_text_tidy(new.transcript);
    new.polished        := public.clean_notebook_text_tidy(new.polished);
    new.what_did        := public.clean_notebook_text_tidy(new.what_did);
    new.why_note        := public.clean_notebook_text_tidy(new.why_note);
    new.engagement_note := public.clean_notebook_text_tidy(new.engagement_note);
    new.mentor_note     := public.clean_notebook_text_tidy(new.mentor_note);
    new.next_step       := public.clean_notebook_text_tidy(new.next_step);
    -- The follow-up answers live in jsonb: clean each answer as its own text,
    -- so the JSON itself is never touched.
    if new.signal_data is not null and jsonb_typeof(new.signal_data) = 'object' then
      new.signal_data := (
        select coalesce(jsonb_object_agg(sig.key,
          case when jsonb_typeof(sig.value) = 'object' then (
            select coalesce(jsonb_object_agg(ans.key,
              case when jsonb_typeof(ans.value) = 'string'
                then to_jsonb(public.clean_notebook_text_tidy(ans.value #>> '{}'))
                else ans.value end), '{}'::jsonb)
            from jsonb_each(sig.value) ans)
          else sig.value end), '{}'::jsonb)
        from jsonb_each(new.signal_data) sig);
    end if;
  end if;
  return new;
end
$$;

drop trigger if exists notebook_voice_clean on notebook_entries;
create trigger notebook_voice_clean
  before insert or update on notebook_entries
  for each row execute function public.notebook_voice_clean();
