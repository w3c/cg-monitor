const table = document.querySelector("tbody");

const report = await (await fetch("spec-reports.json")).json();

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
  // TODO: color scheme/warning on age?
  lmTd.append(spec.lastModified.split("T")[0]);

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
    implTd.classList.add("warning");
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
    refTd.classList.add("warning");
  }

  const transitionTd = document.createElement("td");
  if (spec.transition.notice) {
    const transitionLink = document.createElement("a");
    transitionLink.href = spec.transition.notice;
    transitionLink.append(`${spec.transition.status || ""} to ${spec.transition.wgshortname} (${spec.transition.date})`);
    transitionTd.append(transitionLink);
  } else {
    transitionTd.append(spec.transition);
  }

  const notesTd = document.createElement("td");
  notesTd.append(spec.notes);

  tr.append(specTd, repoTd, lmTd, implTd, refTd, transitionTd, notesTd);
  table.append(tr);
}
