# SuperJ Revived

A browser playground for SuperJ, a programming language designed in childhood. The original compiler only ever finished `print`; the rest of the
language survives as design notes in `archive/JJ/syn.txt`. This project rebuilds it from those notes. It runs entirely in the browser.

```
print("Moga",,"Goga",,"Prosto",,"Loga".);     ->     Moga Goga Prosto Loga
```

That line is `archive/JJ/test.j`, the only program that survived.

## Writing SuperJ

```
int count : 3;
rat third {rat(1) / 3};

print("count =",,count.);

while(count > 0){
    print(count,,);
    count : count - 1;
}
print(.);

if(third > 0)(bool do_all = true){ print("positive"); } \else(){ print("not positive"); }
```

The Learn tab in the app covers the syntax. There are two versions: V1 is the language as originally designed (including the way it dropped spaces
inside strings) and V2 fixes that and adds `take()`, `3i` literals and default parameters. V2 is the default. Ctrl+Enter runs the program.

**Examples > Play Nim** is a small game (`examples/11-play-nim.j`). Type your move in the console and press Enter. It needs V2.

## Develop

Node.js 22 or newer.

```bash
npm install
npm run dev        # http://localhost:5173
npm test
npm run typecheck
npm run build      # output in dist/
npm run preview
```

## Deploy to GitHub Pages

1. Push to GitHub.
2. Settings > Pages > Source: GitHub Actions.
3. Push to `main`, or run the workflow by hand.

`.github/workflows/deploy.yml` tests, builds and publishes to `https://<user>.github.io/<repository>/`. It sets `BASE_PATH` to `/<repository>/`.
To build for another path, set `BASE_PATH` yourself (`BASE_PATH=/some/path/ npm run build`). The default is `./`.

## Docs

- [docs/LANGUAGE_ARCHAEOLOGY.md](docs/LANGUAGE_ARCHAEOLOGY.md): what the archive shows, with file and line references
- [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md): what was kept, repaired or reconstructed
- [docs/RECONSTRUCTION.md](docs/RECONSTRUCTION.md): how the engine works and its limits

The original files in `archive/JJ/` are unmodified. Check them with `cd archive/JJ && sha256sum -c ../MANIFEST.sha256`.

The UI follows the OpenBridge Design System dusk theme.
