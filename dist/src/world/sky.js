import { Color, FogExp2, DirectionalLight, AmbientLight, } from 'three/webgpu';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { EquirectangularReflectionMapping } from 'three/webgpu';
export async function setupSkyAndFog(scene) {
    const fogColor = new Color(0xd4a76a);
    scene.fog = new FogExp2(fogColor.getHex(), 0.012);
    const sun = new DirectionalLight(0xffe0b0, 2.5);
    sun.position.set(80, 30, -60);
    sun.castShadow = true;
    scene.add(sun);
    const ambient = new AmbientLight(0x406080, 0.4);
    scene.add(ambient);
    const rgbeLoader = new RGBELoader();
    const hdriNames = [
        '/hdri/belfast_sunset_puresky_2k.hdr',
        '/hdri/overcast_soil_puresky_2k.hdr',
        '/hdri/qwantani_night_puresky_2k.hdr',
        '/hdri/kloofendal_misty_morning_puresky_2k.hdr',
    ];
    const textures = await Promise.all(hdriNames.map((path) => rgbeLoader.loadAsync(path).then((tex) => {
        tex.mapping = EquirectangularReflectionMapping;
        return tex;
    })));
    const hdris = {
        sunset: textures[0],
        overcast: textures[1],
        night: textures[2],
        mistyMorning: textures[3],
    };
    scene.environment = hdris.sunset;
    scene.background = hdris.sunset;
    scene.backgroundIntensity = 1.0;
    scene.environmentIntensity = 1.0;
    return { sun, ambient, hdris };
}
