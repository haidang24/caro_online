# Game Caro Online

Trò chơi Caro (Gomoku) online multiplayer được xây dựng với JavaScript, Socket.IO và Express.

## Cách cài đặt

1. Cài đặt Node.js (phiên bản 14.x trở lên) từ [nodejs.org](https://nodejs.org/)
2. Clone hoặc tải xuống repository này
3. Mở Terminal/Command Prompt trong thư mục dự án
4. Cài đặt các dependencies:

```bash
npm install
```

## Cách chạy

1. Khởi động server:

```bash
npm start
```

2. Mở trình duyệt và truy cập `http://localhost:3000`
3. Tạo phòng mới bằng cách nhập tên và bỏ trống mã phòng
4. Chia sẻ mã phòng được tạo với bạn bè
5. Người chơi thứ hai nhập tên và mã phòng để tham gia

## Cách chơi

- Người chơi thứ nhất sẽ được đánh dấu X, người chơi thứ hai sẽ được đánh dấu O
- Mục tiêu là tạo thành 5 quân cờ liên tiếp theo chiều ngang, dọc hoặc chéo
- Người chơi luân phiên đánh vào các ô trống trên bàn cờ
- Người chơi đầu tiên đạt được 5 quân cờ liên tiếp sẽ thắng
- Người thắng sẽ được cộng 1 điểm

## Tính năng

- Game multiplayer thời gian thực
- Tạo và tham gia các phòng chơi riêng
- Thay đổi kích thước bàn cờ (10x10, 15x15, 20x20)
- Bảng điểm theo dõi
- Hiệu ứng đánh dấu nước đi cuối cùng 