# Pixel Clash Dojo v3.1.6

Prototype game đối kháng pixel 2D 1v1 chạy trên trình duyệt. Phaser 3 phụ trách input/render; Node.js + Express + Socket.io giữ mô phỏng authoritative 60 Hz, room và multiplayer. Client chỉ gửi phím đang giữ, không gửi tọa độ hoặc damage.

## Cấu trúc

```text
fightGame/
├─ server.js                         # Room, FSM, physics và combat authoritative
├─ package.json
├─ vercel.json                       # Static frontend + rewrite asset cho Vercel
├─ public/
│  ├─ index.html                     # Menu, HUD, command drawer
│  ├─ styles.css                     # UI sáng kiểu anime mission board
│  ├─ game.js                        # Phaser renderer, input, animation, VFX, camera
│  ├─ favicon.svg
│  ├─ shared/game-data.js            # 10 CharacterDefinition dùng chung server/client
│  └─ generated/characters/          # Sheet chuẩn hóa từ đúng source folder
├─ scripts/
│  ├─ build_character_sheets.py      # Tách GIF/frame rời thành sheet browser-ready
│  └─ validate_roster.js             # Chặn thiếu file/frame và trộn ownership
├─ Character_platformer/
│  ├─ Buck Borris/                   # Asset gốc, không sửa
│  ├─ Fantasy Rogue/                 # Asset gốc, không sửa
│  └─ <8 source folder mới>/         # Sprite + source .txt thuộc riêng từng nhân vật
├─ backgound_map/                     # 7 chiến địa từ các pack có source/license riêng
├─ vfx/                               # Pool VFX trung tính, có source .txt riêng
└─ 400 Sounds Pack/                   # SFX chiến đấu/UI, route /sounds
```

`public/shared/game-data.js` là nguồn dữ liệu duy nhất cho kích thước world, hurtbox, tốc độ, frame-data, đường dẫn animation và scale/origin của nhân vật. Khi thêm nhân vật, không rải config ở nhiều file.

## Khởi chạy

Yêu cầu Node.js 18 trở lên:

```powershell
npm install
npm start
```

Mở <http://localhost:3000>. Kiểm tra server:

```powershell
Invoke-RestMethod http://localhost:3000/health
npm run check
```

`npm run check` kiểm tra cả cú pháp lẫn roster: 10 nhân vật phải đủ J/K/I/U,
mọi state runtime phải tồn tại, chỉ số frame không vượt sheet và animation không
được trỏ ra ngoài folder sở hữu. Khi cần sinh lại sheet chuẩn hóa, chạy
`npm run build:characters` rồi chạy lại `npm run check`.

Client và server phải cùng `version` trong `public/shared/game-data.js`. Các file
`index.html`, `styles.css`, `game.js` và `shared/game-data.js` được phục vụ với
`Cache-Control: no-store`; server cũng từ chối tạo/vào phòng nếu client cũ không
gửi đúng version. Nếu một tab đã mở từ trước khi server được cập nhật, nhấn
`Ctrl+F5` một lần để thay toàn bộ mã đang nằm trong bộ nhớ của tab đó.

Không còn bước `npx kill-port`: start không tự tải package phụ và không tự giết tiến trình khác. Nếu port 3000 đang bận:

```powershell
$env:PORT=3001
npm start
```

## Chế độ chơi và mạng

- **Training:** P1 đấu dummy, có Dev mode ẩn trong `ESC → Dev mode`.
- **Đấu máy (PvE):** người chơi đấu CPU authoritative với ba cấp Dễ/Vừa/Khó. Không còn chế độ hai người dùng chung một bàn phím.
- **Tạo phòng:** server cấp mã 4 số, tối đa hai người.
- **Vào phòng:** nhập mã và chọn nhân vật của người chơi P2. Host và guest đều dùng `A/D, Space, J/K/S/W/L/I/U` trên máy riêng của mình.

PvE và online đều chơi đúng hai round. Sau round 2, người thắng nhiều round hơn thắng trận; tỷ số `1–1` hoặc hai round hòa được tính là hòa, không sinh round 3.

Training, PvE và người tạo phòng online được chọn một trong 7 map. Người vào phòng tự nhận đúng map của host. Sáu map có hệ bệ one-way: đấu sĩ nhảy xuyên từ dưới lên và đứng được khi rơi xuống; toàn bộ collision được server tính, không phụ thuộc hình vẽ phía client.

Giao diện được khóa theo đúng viewport ở cả menu lẫn trong trận: trang chính không cuộn ngang/dọc, danh sách map dùng hai nút mũi tên riêng, còn Command Center có thể cuộn nội dung khi màn hình thấp nhưng không hiện thanh scrollbar gây lệch layout. Nút `F` hoặc nút **Toàn màn hình** dùng Fullscreen API và tự chuyển sang chế độ tương thích nếu trình duyệt chặn API.

Test LAN: chạy server trên PC, dùng `ipconfig` lấy IPv4, rồi mở `http://IP-CUA-PC:3000` trên laptop. Cho phép Node qua Windows Firewall ở mạng Private nếu cần.

Test ngrok:

```powershell
ngrok http 3000
```

Gửi URL HTTPS do ngrok cấp. Socket.io dùng cùng origin nên không phải sửa code.

## Điều khiển

| Hành động | Phím trên mỗi máy | Logic |
|---|---|---|
| Di chuyển | `A / D` | Gia tốc/giảm tốc, không đổi vận tốc đột ngột |
| Nhảy đôi | `Space` | Có input buffer 7F và coyote time 6F |
| Light attack | `J` | Dùng được dưới đất/trên không; late-active/recovery cancel sang K/I |
| Special | `K` | Bộ special riêng từng đấu sĩ, dùng được dưới đất/trên không; fighter có charge chỉ gồng khi đứng đất |
| Roll | `W + hướng` | I-frame, cooldown và quãng lăn lấy từ profile từng lớp nhân vật |
| Teleport | `L + hướng` | Hướng phím được ưu tiên; bấm riêng dùng hướng đang nhìn |
| Block | `S` | Chỉ đỡ hướng đang nhìn; trúng sau lưng nhận full damage |
| Kỹ năng riêng | `I` | Cả 10 đấu sĩ đều có đạn riêng về tốc độ, tầm bay, hitbox, damage và VFX |
| Ultimate | `U` | Cần đủ 3 ấn năng lượng; cinematic dừng trận rồi đánh gần như toàn chiến địa |

Phím hệ thống:

- `ESC`: command drawer trong trận.
- `H`: mở bảng hướng dẫn đầy đủ.
- `F3`: hitbox/hurtbox/projectile và tọa độ chân authoritative.
- `F`: bật/tắt fullscreen; có CSS fallback nếu browser từ chối native fullscreen.
- `R`: reset Training.
- `O / P`: chưa gán, dành cho move mới.

## Combat v3.0

- Fixed-step và snapshot đều 60 Hz; renderer nội suy vị trí authoritative và làm tròn pixel.
- FSM: `APPEAR, IDLE, RUN, JUMP, FALL, LAND, CHARGE, ATTACK, BLOCK, ROLL, TELEPORT, HURT, KO`.
- Double jump, coyote time và input buffer giúp điều khiển bớt cứng.
- Block chính diện nhận chip damage, không knockback. Block sai hướng không có tác dụng.
- Roll bắt buộc kèm hướng, teleport chốt hướng ở frame bấm; cả hai có i-frame/cooldown riêng và giữ nguyên tọa độ authoritative sau khi kết thúc.
- J/K/I dùng được trên không với air-stall ngắn, gravity riêng và air drift. Light có cửa cancel `J → K/I` ở cuối active/recovery.
- Arena rộng `2400 px` trong viewport `960×540`. Camera pan theo trung điểm và zoom động `1.0 → 0.4` để luôn giữ hai đấu sĩ trong khung.
- Có 7 map chọn được. Background được phủ theo từng đoạn 960 px về cả trái/phải; ground world ở `y=1175` nhưng camera giữ mặt đất ở `y=470` trên màn hình.
- Map data và platform rectangle nằm trong `public/shared/game-data.js`. Platform là one-way collision authoritative, layout đối xứng quanh tâm world để không tạo lợi thế spawn cho PvP.
- Hit-stop authoritative; client dừng animation trong đúng khoảng tương ứng.
- Special trúng mới camera shake. HURT chớp trắng/đỏ.
- Training dummy tự hồi máu, không kết thúc round.
- Match PvE/online cố định 2 round, mỗi round tối đa 99 giây; tỷ số 1–1 là hòa.
- Ultimate là dữ liệu và sát thương authoritative: mỗi hit-confirm thường, kể cả đòn bị block, cộng đúng 1 ấn; whiff/i-frame không cộng. Đủ 3 ấn thì HUD nhấp nháy `U READY`; dùng chiêu sẽ tiêu hết 3 ấn và meter trở về 0. Meter cũng trở về 0 khi bắt đầu round mới.
- Cinematic Ultimate khóa physics và đồng hồ trận. Người phòng thủ vẫn được giữ `S`, hoặc `A/D + S` để quay mặt về phía người ra chiêu trước impact; đỡ đúng hướng nhận chip damage và không bị knockback.
- Cả 10 đấu sĩ có Ultimate riêng: 54F intro + 1F impact + 60F aftermath, meter 3 hit-confirm và damage/chip theo class. Mỗi Ultimate có tên, bố cục toàn sân, màu, camera, hit confirm và lớp âm thanh riêng; không có nhánh “nhân vật khác thì dùng Rogue”.

Frame-data chính nằm trong `public/shared/game-data.js`; thay số ở đó để server và debug overlay cùng dùng một giá trị.

## Mapping asset đã kiểm kê

### Buck Borris

Nguồn: [Super Ginger Hero](https://penusbmic.itch.io/super-ginger-hero).

Các PNG là sheet dọc `121×23` mỗi frame:

| File | Số frame | Gán |
|---|---:|---|
| `appear.png` | 4 | Intro 3 giây |
| `idle.png` | 5 | Idle / fallback block |
| `run.png` | 4 | Run |
| `jump.png`, `fall.png` | 1 | Lên / xuống |
| `land.png` | 2 | Landing |
| `attacks.png` | 12 | `J` light |
| `charge.png` | 8 | Giữ `K` |
| `blast.png` | 6 | Thả `K` |
| `roll.png` | 7 | `W + hướng` |
| `teleport.png` | 5 | `L` |
| `damaged.png` | 2 | Hurt / KO fallback |

Thân Buck nằm quanh `x=40` trong frame rộng 121 vì phần còn lại dành cho hiệu ứng. Renderer dùng origin chân `40/121, 1`; khi quay trái origin đổi thành `1 - 40/121` trước khi `flipX`. Đây là sửa lỗi hình nhảy sang phải trong khi hurtbox vẫn đứng yên. Scale hiện là số nguyên `×3`; Rogue là `×2` để sân có nhiều không gian chạy/né hơn.

Buck chưa có animation block và death riêng. Bản v2 giữ đúng asset Buck: block dùng idle + guard arc/tint, KO dùng damaged; không mượn art của Rogue.

`I` của Buck dùng `blast.png` làm animation phóng và bộ [Fireball Animations](https://weentermakesgames.itch.io/fireball-animations) trong folder VFX làm viên đạn. Hỏa Cầu Nén có startup 11F, cooldown 52F, hitbox đạn `38×28`, bay chậm hơn dao Rogue nhưng gây 14 damage, hitstun/knockback lớn hơn. Đây là VFX trung lập ghép lên Buck, tuyệt đối không dùng `Flying Knife.png` của Rogue.

### Fantasy Rogue

Nguồn: [Fantasy Rogue](https://chroma-dave.itch.io/fantasy-rogue-character). Trang nguồn mô tả 11 animation và Flying Dagger đi kèm ranged attack.

`Rogue - Full.png` là atlas `832×704`, grid `13×11`, mỗi ô `64×64`. Chỉ số atlas thật:

| Animation/tag Aseprite | Atlas PNG |
|---|---|
| Idle | `0–5` |
| Run | `13–18` |
| Jump | `26–31` |
| Ledge Grab | `39–40` — chưa dùng trong arena phẳng |
| Ledge Jump | `52–58` — chưa dùng trong arena phẳng |
| Attack | `65–68` |
| Throw | `78–81` |
| Teleport | `91–103` — frame 97 trong suốt có chủ ý |
| Dash | `104–111` |
| Hurt | `117–119` |
| Death | `130–138` |

Sai lầm cũ là dùng frame logic liên tục `0–67` làm chỉ số atlas Phaser, khiến nhiều animation lấy nhầm ô trống hoặc cắt sai hàng. V2.2 dùng đúng chỉ số từng hàng. Chân Rogue nằm ở `y≈48` trong ô 64 px, nên origin là `0.5, 48/64` và scale `×2`; dùng origin đáy ô `1.0` sẽ làm nhân vật nổi khỏi ground.

`Flying Knife.png` là 8 frame `16×16`, chỉ Rogue được phép load file này.

### Tám lớp nhân vật mở rộng

Mỗi hàng dưới đây chỉ đọc sprite từ folder cùng tên. `public/generated/characters`
không phải asset vẽ thay thế: đó là bản sheet runtime được tách/đệm/căn lại từ đúng
PNG, frame rời hoặc GIF của nhân vật tương ứng; asset gốc vẫn nguyên vẹn.

| Fighter | Source folder | Vai trò | J / K / I / U |
|---|---|---|---|
| Soul Knight | `2D_SL_Knight_v1.0` | Guard / greatsword | Oath Blade / Crescent Execution / Soul Lance / Hắc Kiếm Tận Thế |
| Dragon Knight | `dragon_knight` | Flame / pressure | Dragon Claw / Dragon Breath (giữ K để gồng) / Drake Fireball / Long Viêm Thiên Táng |
| Iron Sentinel | `iron_sentinel` | Tank / counter | Sentinel Cleave / Shield Crash / Iron Shockwave / Pháo Đài Thiết Chấn |
| Dark Ninja | `Pixel_DarkNinja_32px` | Ninjutsu / vanish | Kage Claw / Shadow Crescent / Void Shuriken / Nhẫn Pháp: Nhật Thực |
| Purple Battlemage | `PurpleGirl` | Arcane / zoning | Arcane Palm / Arcane Spin / Fast Arcane Bolt / Tinh Vực Tử Quang |
| Velociraptor | `raptor` | Rushdown / pounce | Rending Bite / Predator Pounce / Sonic Roar / Kỷ Phấn Truy Sát |
| Stick Fighter | `Stick Figure Character Sprites 2D` | Comic / freestyle | Freestyle Combo / Rubber-line Smash / Doodle Shot / Nét Mực Phá Giới |
| Vagabond | `vagabond` | Sci-fi / blade | Plasma Edge / Charged Saber / Vacuum Blade / Tinh Kiếm Chân Không |

Dark Ninja ghép đúng chuỗi Teleport 1 → Teleport 2; Raptor được đệm cell 128×64
để các frame lệch kích thước không giật chân; Stick Fighter được hạ 512×512 về
128×128; Vagabond được composite GIF thành PNG sheet 64/128×64. Renderer vẫn dùng
nearest-neighbor/pixel snapping, còn `origin` và `hurtbox` được đo theo chân/thân
hiển thị chứ không theo mép trong suốt của file.

### Background và chiến địa

Catalog v2.5 dùng đúng asset trong `backgound_map`: Sa mạc Thiên Sơn, Rừng Cổ Thụ, Đỉnh Băng Lam, Chân Núi Tùng, Đồng Cỏ Gió, Cực Quang Dạ và Vịnh Đá Trắng. Sa mạc giữ ba layer + cloud gốc; các pack còn lại dùng composite do chính pack cung cấp. Ground authoritative là `y=1175`; camera bù offset để mặt đất vẫn nằm ở `y=470` trên viewport. Không vẽ bóng giả dưới chân.

Các bệ grass/ice/stone được vẽ bằng Phaser từ palette riêng của map nhưng collision rectangle nằm trong shared data và được Node.js xử lý. Bố cục bệ đối xứng để giữ công bằng; F3 hiển thị cả hurtbox, hitbox và biên platform.

### VFX kitbash theo nhân vật

Nguồn dùng trong build: [Free VFX Asset Pack của CodeManu](https://codemanu.itch.io/vfx-free-pack), [750 Effect & FX Pixel của BDragon1727](https://bdragon1727.itch.io/750-effect-and-fx-pixel-all), [Thunder Spell Effect 02 của pimen](https://pimen.itch.io/thunder-spell-effect-02), [Fireball Animations của Weenter](https://weentermakesgames.itch.io/fireball-animations) và `Free Pixel Effects Pack` có README/license đặt ngay trong folder local. `CHARACTER_VFX` trong `public/game.js` là lớp định danh hình ảnh riêng cho từng đấu sĩ:

- Buck và Rogue giữ nguyên kit đã kiểm chứng; tám đấu sĩ mới có `CHARACTER_VFX` riêng theo class (soul, fire, iron/thunder, shadow, arcane, predator, comic và vacuum blade).
- Ultimate không mượn sheet nhân vật của nhau. Mười profile cinematic dùng 10 pattern riêng: worldbreaker, thousand blades, abyssal oath, dragon inferno, citadel breaker, eclipse, arcane dominion, cretaceous hunt, panel breaker và event horizon. VFX ghép thêm đều lấy từ pool trung tính `vfx`; animation thân luôn lấy đúng folder nhân vật.
- `APPEAR`, nhảy, nhảy đôi, bắt đầu rơi, đáp đất, bắt đầu đỡ, hurt và KO đều có profile riêng; chạy A/D không sinh VFX. Server phát event `jump` riêng để double jump vẫn có hiệu ứng dù FSM đang ở JUMP. Flying Knife tạo trail tím mỗi 85 ms; Hỏa Cầu Nén tạo sparkle/puff cam có giới hạn 70 ms để không làm nặng GPU.
- Comic pop-up (`BỐP!`, `KENG!`, `VỤT!`, `ĐOÀNG!`, `ĐO VÁN!`) là Phaser text tự hủy, chỉ phục vụ game-feel và không tham gia hitbox.
- Trong Training, mở `ESC → Dev mode → Trình diễn VFX` để chạy sampler ba nhịp trên cả hai đấu sĩ mà không đổi máu, vị trí hay hitbox.
- Hit confirm cũng tách theo người ra đòn: Buck thiên va đập/nổ, Rogue thiên vortex/slash tím. Guard vẫn dùng `ElectricShield` vì đây là phản hồi hệ thống chung.
- Các sheet CodeManu cùng các effect số `03`, `13`, `24`, `25`, `26` và hai sheet thunder đều có vai trò xác định; không quét tải toàn bộ hơn 2.500 file trong folder.

Không preload toàn bộ các pack vì sẽ tốn GPU memory và làm browser giật. Khi thêm nhân vật, thêm profile `moves`, `states` và `mobility` mới thay vì viết nhánh điều kiện rải rác. Gói BDragon bản free chỉ cho game phi thương mại; build bài tập/bạn bè hiện phù hợp, nhưng phải mua/đóng góp theo điều kiện trang nguồn trước khi phát hành thương mại.

### Âm thanh đã gắn

Nguồn: [400 Sounds Pack của ci.itch.io](https://ci.itch.io/400-sounds-pack). Route `/sounds` chỉ tải 32 WAV được chọn, bổ sung thud/pop khi đáp đất, twang khi nhảy, fall cue, mystery khi xuất hiện/teleport, sparkle, thunder, defeated/record scratch khi KO và sáu cue riêng cho meter/cinematic/impact Ultimate. Âm được xếp lớp ở volume thấp và có delay ngắn để rõ nhịp, không phát sound cho chạy A/D. Slider âm lượng điều khiển toàn bộ các lớp; âm tổng hợp chỉ còn là fallback.

## Lắp VFX mới mà không trộn nhân vật

1. Đặt VFX vào đúng folder chủ sở hữu, ví dụ:

```text
Character_platformer/Buck Borris/Buck Borris/my-blast.png
Character_platformer/Fantasy Rogue/Full/my-shadow-slash.png
```

2. Mở `public/game.js`, tìm `VFX_KIT` và đổi entry `null` thành config:

```js
special: {
  url: '/assets/Buck Borris/Buck Borris/my-blast.png',
  frameWidth: 96,
  frameHeight: 64,
  frames: 8,
  frameRate: 18,
  fit: 'stretch-x',
  widthScale: 1,
  heightScale: 1.15
}
```

`fit: 'stretch-x'` kéo dài hiệu ứng theo tầm chiêu nhưng giữ tỷ lệ chiều cao; `fit: 'hitbox'` lấp toàn hitbox; bỏ `fit` để dùng `scale` cố định.

3. Server phát `attack-active` đúng Active frame với box authoritative. Client đặt VFX ở tâm box, flip theo hướng, co giãn theo config, chạy một lần rồi tự hủy.
4. Loader từ chối config Buck trỏ vào `/assets/Fantasy Rogue/` và ngược lại.

Có thể gửi GIF động để đối chiếu nhịp và thứ tự hình; công cụ đọc/tách được frame GIF. Tuy nhiên, để cắt sheet và lấy timing chuẩn nên ưu tiên `.aseprite`/PNG gốc vì GIF có thể mất alpha, màu và metadata tag.

## Training Dev mode

Dev mode mặc định ẩn và chỉ hiện trong Training:

- P1 bất tử.
- Máu P1 vô hạn.
- Roll/teleport/ability không cooldown.
- Đóng băng dummy.
- Dummy tự quay mặt và block chính diện.
- Pause mô phỏng + `Frame +1` để soi frame-data.
- Nạp đầy 3 ấn Ultimate để test phím `U`, hoặc **Dùng Ultimate ngay** để chạy thẳng cinematic khi đang cân chỉnh VFX/camera.
- Reset training và bật hitbox.

Các cờ gameplay gửi lên server; client không tự bật bất tử bằng cách sửa HP.

## Deploy

Phaser/HTML/CSS có thể đặt trên Vercel. `vercel.json` đã rewrite `/assets`, `/backgrounds`, `/common-vfx`, `/sounds` và `/shared` đến folder gốc.

Socket.io cần tiến trình Node và kết nối WebSocket lâu dài; Vercel static/serverless không phải nơi phù hợp cho `server.js`. Deploy backend lên Render, Railway, Fly.io hoặc VPS, rồi mở frontend bằng:

```text
https://ten-game.vercel.app/?socket=https://ten-backend.onrender.com
```

`game.js` sẽ tải Socket.io client trực tiếp từ backend trong `?socket=`. Khi public thật, đặt biến `CLIENT_ORIGIN` ở backend để khóa CORS về domain frontend.

## Đánh giá phát hành nghiêm ngặt

V3 đủ để làm prototype chơi/test LAN, frame-data, VFX, roster 10 nhân vật và room. Chưa nên gọi là bản phát hành thương mại vì còn thiếu:

1. Rollback/prediction chuẩn game đối kháng cho ping cao; hiện dùng authoritative snapshot + interpolation.
2. Combo tree nhiều nhánh, throw, crouch và move riêng sâu hơn cho mọi nhân vật (prototype đã có air attack và light → special/ability cancel cơ bản).
3. Animation block/death thật cho Buck và một animation special melee thứ hai cho Rogue.
4. Account, matchmaking, reconnect giữ ghế, anti-spam/rate limit và origin allow-list production.
5. Background music và mobile/touch controls (màn chọn map và combat SFX thật đã được tích hợp).
6. Kiểm tra license/attribution lần cuối trước khi public hoặc kiếm tiền.

Phaser 3 là lựa chọn phù hợp cho prototype browser hiện tại; không có lý do quay lại Phaser 2.
