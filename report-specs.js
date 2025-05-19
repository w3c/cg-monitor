const table = document.querySelector("tbody");
const list = document.querySelector("dl");

const report = await (await fetch("spec-reports.json")).json();

const now = new Date();


function age(since) {
  const then = new Date(since);
  return (now - then)/(24*3600*1000);

}

function addWarning(el, msg) {
  el.classList.add("warning");
  const warning = document.createElement("span");
  warning.textContent = "⚠";
  warning.title = msg;
  warning.setAttribute("aria-label", msg);
  el.prepend(warning);
}

for (const spec of report.wicg.specs.sort((a, b) => a.lastModified.localeCompare(b.lastModified))) {
  const tr = document.createElement("tr");
  const specTd = document.createElement("td");
  const link = document.createElement("a");
  link.href = spec.url;
  link.append(spec.title);
  specTd.append(link);

  const repoTd = document.createElement("td");
  const repoLink = document.createElement("a");
  repoLink.href = `https://github.com/${spec.repo}/`;
  repoLink.append(spec.repo);
  repoTd.append(repoLink);

  const lmTd = document.createElement("td");
  lmTd.append(spec.lastModified.split("T")[0]);
  if (age(spec.lastModified) > 365) {
    addWarning(lmTd, "Not modified for more than a year");
  }

  const implTd = document.createElement("td");

  // FIXME: browser-spec specific
  for (const impl of spec.implementations) {
    const img = document.createElement("img");
    img.src = `https://wpt.fyi/static/${impl}_64x64.png`;
    img.alt = `Implemented in ${impl}`;
    img.width = 32;
    implTd.append(img);
  }
  if (spec.implementations.length > 1) {
    addWarning(implTd, "2+ implementations");
  }

  const refTd = document.createElement("td");

  for (const ref of spec.referencedBy) {
    const a = document.createElement("a");
    a.href = ref.url;
    a.append(ref.title);
    refTd.append(a);
    refTd.append(document.createElement("br"));
  }
  if (spec.referencedBy.length) {
    addWarning(refTd, "Referenced by other specs");
  }

  const charterTd = document.createElement("td");

  for (const ref of spec.linkedFrom) {
    const a = document.createElement("a");
    a.href = ref.link;
    a.append(`${ref.shortname.toUpperCase()} WG`);
    charterTd.append(a);
    charterTd.append(document.createElement("br"));
  }
  if (spec.linkedFrom.length) {
    addWarning(charterTd, "Linked from WG charter");
  }

  const transitionTd = document.createElement("td");
  if (spec.transition.notice) {
    const transitionLink = document.createElement("a");
    transitionLink.href = spec.transition.notice;
    transitionLink.append(`${spec.transition.status || ""} to ${spec.transition.wgshortname} (${spec.transition.date})`);
    transitionTd.append(transitionLink);
    if (spec.transition.status === "complete") {
      addWarning(transitionTd, "Transition complete, needs archiving");
    } else if (spec.transition.date && (spec.transition.status === "pending" || spec.transition.status === "started")) {
      if (age(spec.transition.date) > 365) {
	addWarning(transitionTd, "Incomplete transition for more than a year");
      }
    }
  } else {
    transitionTd.append(spec.transition);
  }

  const notesTd = document.createElement("td");
  notesTd.append(spec.notes);

  tr.append(specTd, repoTd, lmTd, implTd, refTd, charterTd, transitionTd, notesTd);
  table.append(tr);
}


for (const repo of Object.keys(report.wicg.repos).sort((a,b) => report.wicg.repos[a]?.lastModified?.localeCompare(report.wicg.repos[b].lastModified))) {
  const dt = document.createElement("dt");
  const link = document.createElement("a");
  link.href = `https://github.com/${repo}`;
  link.textContent = repo;
  dt.append(link);
  list.append(dt);
  const {transition, lastModified, notes, linkedFrom} = report.wicg.repos[repo];
  let computedNotes = notes;

  if (transition?.notice) {
    const transitionDd = document.createElement("dd");
    const transitionLink = document.createElement("a");
    transitionLink.href = transition.notice;
    transitionLink.append(`${transition.status || ""} to ${transition.wgshortname} (${transition.date})`);
    transitionDd.append(transitionLink);
    if (transition.status === "complete") {
      computedNotes = "transitioned, needs archiving";
    } else if (transition.status === "pending") {
      if (age(transition.date) > 365) {
	computedNotes = "transition pending for more than a year, may need discussion";
      }
    }

    list.append(transitionDd);
  }
  if (lastModified) {
    const lmDd = document.createElement("dd");
    lmDd.append(`Last modified on ${lastModified.split("T")[0]}`);
    list.append(lmDd);
  }

  if (linkedFrom?.length) {
    const lfDd = document.createElement("dd");
    lfDd.innerHTML = `Linked from ${linkedFrom.map(f => `<a href="${f.link}">${f.shortname.toUpperCase()} WG charter</a>`).join(',')}`;
    list.append(lfDd);
  }
  
  if (computedNotes) {
    const dd = document.createElement("dd");
    dd.classList.add("warning");
    dd.textContent = "⚠" + computedNotes;
    list.append(dd);
  }
}
