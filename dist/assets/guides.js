// Keep the long chapter list out of the first mobile reading screen.
document.addEventListener('DOMContentLoaded', () => {
  const contents = document.querySelector('.article-sidebar details');
  if (contents) contents.open = !window.matchMedia('(max-width:760px)').matches;
});
