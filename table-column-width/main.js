"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const obsidian_1 = require("obsidian");
const FROZEN_CLASS = "tcw-frozen";
const SCROLL_CLASS = "tcw-scroll";
class TableColumnWidthPlugin extends obsidian_1.Plugin {
    constructor() {
        super(...arguments);
        this.observer = null;
    }
    onload() {
        this.app.workspace.onLayoutReady(() => {
            this.freezeAll();
            this.startObserver();
        });
        // 后台标签页中的表格渲染时容器可能没有布局（宽度为 0）会被跳过，
        // 切换回该标签页时补一次扫描
        this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.freezeAll()));
    }
    onunload() {
        this.observer?.disconnect();
    }
    // 用 MutationObserver 而不是 MarkdownPostProcessor：
    // 回调是微任务，在 DOM 插入之后、浏览器绘制之前执行，
    // 「测量 auto 宽度 → 应用固定布局」在同一帧内完成，无视觉跳变
    startObserver() {
        this.observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                mutation.addedNodes.forEach((node) => {
                    if (node instanceof HTMLTableElement) {
                        this.freezeTable(node);
                    }
                    else if (node instanceof HTMLElement) {
                        node.querySelectorAll("table").forEach((table) => this.freezeTable(table));
                    }
                });
            }
        });
        this.observer.observe(document.body, { childList: true, subtree: true });
        this.register(() => this.observer?.disconnect());
    }
    freezeAll() {
        document.querySelectorAll(".markdown-preview-view table").forEach((table) => {
            if (table instanceof HTMLTableElement)
                this.freezeTable(table);
        });
    }
    // 懒冻结的显示半边：只在内存中冻结，不写标记行、不改动笔记文件
    freezeTable(table) {
        if (table.classList.contains(FROZEN_CLASS))
            return;
        // 只处理阅读模式渲染的表格（排除编辑模式 CM6 小部件等）
        if (!table.closest(".markdown-preview-view"))
            return;
        // Dataview 等插件渲染的动态表格不受影响
        if (table.closest(".block-language-dataview, .block-language-dataviewjs, .dataview"))
            return;
        if (table.closest(`.${SCROLL_CLASS}`))
            return;
        const firstRow = table.rows[0];
        if (!firstRow)
            return;
        // 趁表格仍是 auto 布局时测量每列实际宽度
        // （auto 布局下同列所有单元格宽度一致，读首行即可）
        const widths = Array.from(firstRow.cells).map((cell) => cell.offsetWidth);
        if (widths.length === 0 || widths.some((w) => w <= 0))
            return;
        const total = widths.reduce((sum, w) => sum + w, 0);
        const colgroup = document.createElement("colgroup");
        for (const w of widths) {
            const col = document.createElement("col");
            col.style.width = `${w}px`;
            colgroup.appendChild(col);
        }
        table.insertBefore(colgroup, table.firstChild);
        // fixed 布局下 Chrome 会把 auto 宽度的表格拉满容器，
        // 显式设置总宽，窄表格才能保持实际宽度左对齐不拉伸
        table.style.width = `${total}px`;
        table.classList.add(FROZEN_CLASS);
        // 包一层滚动容器：总宽超出笔记区域时横向滚动
        const wrapper = document.createElement("div");
        wrapper.className = SCROLL_CLASS;
        table.parentElement?.insertBefore(wrapper, table);
        wrapper.appendChild(table);
    }
}
exports.default = TableColumnWidthPlugin;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm1haW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSx1Q0FBa0M7QUFFbEMsTUFBTSxZQUFZLEdBQUcsWUFBWSxDQUFDO0FBQ2xDLE1BQU0sWUFBWSxHQUFHLFlBQVksQ0FBQztBQUVsQyxNQUFxQixzQkFBdUIsU0FBUSxpQkFBTTtJQUExRDs7UUFDUyxhQUFRLEdBQTRCLElBQUksQ0FBQztJQStFbEQsQ0FBQztJQTdFQSxNQUFNO1FBQ0wsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsYUFBYSxDQUFDLEdBQUcsRUFBRTtZQUNyQyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDakIsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO1FBQ3RCLENBQUMsQ0FBQyxDQUFDO1FBQ0gsbUNBQW1DO1FBQ25DLGdCQUFnQjtRQUNoQixJQUFJLENBQUMsYUFBYSxDQUNqQixJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsb0JBQW9CLEVBQUUsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQ25FLENBQUM7SUFDSCxDQUFDO0lBRUQsUUFBUTtRQUNQLElBQUksQ0FBQyxRQUFRLEVBQUUsVUFBVSxFQUFFLENBQUM7SUFDN0IsQ0FBQztJQUVELGdEQUFnRDtJQUNoRCwrQkFBK0I7SUFDL0IscUNBQXFDO0lBQzdCLGFBQWE7UUFDcEIsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLGdCQUFnQixDQUFDLENBQUMsU0FBUyxFQUFFLEVBQUU7WUFDbEQsS0FBSyxNQUFNLFFBQVEsSUFBSSxTQUFTLEVBQUUsQ0FBQztnQkFDbEMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRTtvQkFDcEMsSUFBSSxJQUFJLFlBQVksZ0JBQWdCLEVBQUUsQ0FBQzt3QkFDdEMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENB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QUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUVsQyx3QkFBd0I7UUFDeEIsTUFBTSxPQUFPLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUM5QyxPQUFPLENBQUMsU0FBUyxHQUFHLFlBQVksQ0FBQztRQUNqQyxLQUFLLENBQUMsYUFBYSxFQUFFLFlBQVksQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDbEQsT0FBTyxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUM1QixDQUFDO0NBQ0Q7QUFoRkQseUNBZ0ZDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgUGx1Z2luIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbmNvbnN0IEZST1pFTl9DTEFTUyA9IFwidGN3LWZyb3plblwiO1xuY29uc3QgU0NST0xMX0NMQVNTID0gXCJ0Y3ctc2Nyb2xsXCI7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFRhYmxlQ29sdW1uV2lkdGhQbHVnaW4gZXh0ZW5kcyBQbHVnaW4ge1xuXHRwcml2YXRlIG9ic2VydmVyOiBNdXRhdGlvbk9ic2VydmVyIHwgbnVsbCA9IG51bGw7XG5cblx0b25sb2FkKCk6IHZvaWQge1xuXHRcdHRoaXMuYXBwLndvcmtzcGFjZS5vbkxheW91dFJlYWR5KCgpID0+IHtcblx0XHRcdHRoaXMuZnJlZXplQWxsKCk7XG5cdFx0XHR0aGlzLnN0YXJ0T2JzZXJ2ZXIoKTtcblx0XHR9KTtcblx0XHQvLyDlkI7lj7DmoIfnrb7pobXkuK3nmoTooajmoLzmuLLmn5Pml7blrrnlmajlj6/og73msqHmnInluIPlsYDvvIjlrr3luqbkuLogMO+8ieS8muiiq+i3s+i/h++8jFxuXHRcdC8vIOWIh+aNouWbnuivpeagh+etvumhteaXtuihpeS4gOasoeaJq+aPj1xuXHRcdHRoaXMucmVnaXN0ZXJFdmVudChcblx0XHRcdHRoaXMuYXBwLndvcmtzcGFjZS5vbihcImFjdGl2ZS1sZWFmLWNoYW5nZVwiLCAoKSA9PiB0aGlzLmZyZWV6ZUFsbCgpKVxuXHRcdCk7XG5cdH1cblxuXHRvbnVubG9hZCgpOiB2b2lkIHtcblx0XHR0aGlzLm9ic2VydmVyPy5kaXNjb25uZWN0KCk7XG5cdH1cblxuXHQvLyDnlKggTXV0YXRpb25PYnNlcnZlciDogIzkuI3mmK8gTWFya2Rvd25Qb3N0UHJvY2Vzc29y77yaXG5cdC8vIOWbnuiwg+aYr+W+ruS7u+WKoe+8jOWcqCBET00g5o+S5YWl5LmL5ZCO44CB5rWP6KeI5Zmo57uY5Yi25LmL5YmN5omn6KGM77yMXG5cdC8vIOOAjOa1i+mHjyBhdXRvIOWuveW6piDihpIg5bqU55So5Zu65a6a5biD5bGA44CN5Zyo5ZCM5LiA5bin5YaF5a6M5oiQ77yM5peg6KeG6KeJ6Lez5Y+YXG5cdHByaXZhdGUgc3RhcnRPYnNlcnZlcigpOiB2b2lkIHtcblx0XHR0aGlzLm9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoKG11dGF0aW9ucykgPT4ge1xuXHRcdFx0Zm9yIChjb25zdCBtdXRhdGlvbiBvZiBtdXRhdGlvbnMpIHtcblx0XHRcdFx0bXV0YXRpb24uYWRkZWROb2Rlcy5mb3JFYWNoKChub2RlKSA9PiB7XG5cdFx0XHRcdFx0aWYgKG5vZGUgaW5zdGFuY2VvZiBIVE1MVGFibGVFbGVtZW50KSB7XG5cdFx0XHRcdFx0XHR0aGlzLmZyZWV6ZVRhYmxlKG5vZGUpO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAobm9kZSBpbnN0YW5jZW9mIEhUTUxFbGVtZW50KSB7XG5cdFx0XHRcdFx0XHRub2RlLnF1ZXJ5U2VsZWN0b3JBbGwoXCJ0YWJsZVwiKS5mb3JFYWNoKCh0YWJsZSkgPT4gdGhpcy5mcmVlemVUYWJsZSh0YWJsZSkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0dGhpcy5vYnNlcnZlci5vYnNlcnZlKGRvY3VtZW50LmJvZHksIHsgY2hpbGRMaXN0OiB0cnVlLCBzdWJ0cmVlOiB0cnVlIH0pO1xuXHRcdHRoaXMucmVnaXN0ZXIoKCkgPT4gdGhpcy5vYnNlcnZlcj8uZGlzY29ubmVjdCgpKTtcblx0fVxuXG5cdHByaXZhdGUgZnJlZXplQWxsKCk6IHZvaWQge1xuXHRcdGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCIubWFya2Rvd24tcHJldmlldy12aWV3IHRhYmxlXCIpLmZvckVhY2goKHRhYmxlKSA9PiB7XG5cdFx0XHRpZiAodGFibGUgaW5zdGFuY2VvZiBIVE1MVGFibGVFbGVtZW50KSB0aGlzLmZyZWV6ZVRhYmxlKHRhYmxlKTtcblx0XHR9KTtcblx0fVxuXG5cdC8vIOaHkuWGu+e7k+eahOaYvuekuuWNiui+ue+8muWPquWcqOWGheWtmOS4reWGu+e7k++8jOS4jeWGmeagh+iusOihjOOAgeS4jeaUueWKqOeslOiusOaWh+S7tlxuXHRwcml2YXRlIGZyZWV6ZVRhYmxlKHRhYmxlOiBIVE1MVGFibGVFbGVtZW50KTogdm9pZCB7XG5cdFx0aWYgKHRhYmxlLmNsYXNzTGlzdC5jb250YWlucyhGUk9aRU5fQ0xBU1MpKSByZXR1cm47XG5cdFx0Ly8g5Y+q5aSE55CG6ZiF6K+75qih5byP5riy5p+T55qE6KGo5qC877yI5o6S6Zmk57yW6L6R5qih5byPIENNNiDlsI/pg6jku7bnrYnvvIlcblx0XHRpZiAoIXRhYmxlLmNsb3Nlc3QoXCIubWFya2Rvd24tcHJldmlldy12aWV3XCIpKSByZXR1cm47XG5cdFx0Ly8gRGF0YXZpZXcg562J5o+S5Lu25riy5p+T55qE5Yqo5oCB6KGo5qC85LiN5Y+X5b2x5ZONXG5cdFx0aWYgKHRhYmxlLmNsb3Nlc3QoXCIuYmxvY2stbGFuZ3VhZ2UtZGF0YXZpZXcsIC5ibG9jay1sYW5ndWFnZS1kYXRhdmlld2pzLCAuZGF0YXZpZXdcIikpIHJldHVybjtcblx0XHRpZiAodGFibGUuY2xvc2VzdChgLiR7U0NST0xMX0NMQVNTfWApKSByZXR1cm47XG5cblx0XHRjb25zdCBmaXJzdFJvdyA9IHRhYmxlLnJvd3NbMF07XG5cdFx0aWYgKCFmaXJzdFJvdykgcmV0dXJuO1xuXG5cdFx0Ly8g6LaB6KGo5qC85LuN5pivIGF1dG8g5biD5bGA5pe25rWL6YeP5q+P5YiX5a6e6ZmF5a695bqmXG5cdFx0Ly8g77yIYXV0byDluIPlsYDkuIvlkIzliJfmiYDmnInljZXlhYPmoLzlrr3luqbkuIDoh7TvvIzor7vpppbooYzljbPlj6/vvIlcblx0XHRjb25zdCB3aWR0aHMgPSBBcnJheS5mcm9tKGZpcnN0Um93LmNlbGxzKS5tYXAoKGNlbGwpID0+IGNlbGwub2Zmc2V0V2lkdGgpO1xuXHRcdGlmICh3aWR0aHMubGVuZ3RoID09PSAwIHx8IHdpZHRocy5zb21lKCh3KSA9PiB3IDw9IDApKSByZXR1cm47XG5cdFx0Y29uc3QgdG90YWwgPSB3aWR0aHMucmVkdWNlKChzdW0sIHcpID0+IHN1bSArIHcsIDApO1xuXG5cdFx0Y29uc3QgY29sZ3JvdXAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiY29sZ3JvdXBcIik7XG5cdFx0Zm9yIChjb25zdCB3IG9mIHdpZHRocykge1xuXHRcdFx0Y29uc3QgY29sID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImNvbFwiKTtcblx0XHRcdGNvbC5zdHlsZS53aWR0aCA9IGAke3d9cHhgO1xuXHRcdFx0Y29sZ3JvdXAuYXBwZW5kQ2hpbGQoY29sKTtcblx0XHR9XG5cdFx0dGFibGUuaW5zZXJ0QmVmb3JlKGNvbGdyb3VwLCB0YWJsZS5maXJzdENoaWxkKTtcblx0XHQvLyBmaXhlZCDluIPlsYDkuIsgQ2hyb21lIOS8muaKiiBhdXRvIOWuveW6pueahOihqOagvOaLiea7oeWuueWZqO+8jFxuXHRcdC8vIOaYvuW8j+iuvue9ruaAu+Wuve+8jOeqhOihqOagvOaJjeiDveS/neaMgeWunumZheWuveW6puW3puWvuem9kOS4jeaLieS8uFxuXHRcdHRhYmxlLnN0eWxlLndpZHRoID0gYCR7dG90YWx9cHhgO1xuXHRcdHRhYmxlLmNsYXNzTGlzdC5hZGQoRlJPWkVOX0NMQVNTKTtcblxuXHRcdC8vIOWMheS4gOWxgua7muWKqOWuueWZqO+8muaAu+Wuvei2heWHuueslOiusOWMuuWfn+aXtuaoquWQkea7muWKqFxuXHRcdGNvbnN0IHdyYXBwZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuXHRcdHdyYXBwZXIuY2xhc3NOYW1lID0gU0NST0xMX0NMQVNTO1xuXHRcdHRhYmxlLnBhcmVudEVsZW1lbnQ/Lmluc2VydEJlZm9yZSh3cmFwcGVyLCB0YWJsZSk7XG5cdFx0d3JhcHBlci5hcHBlbmRDaGlsZCh0YWJsZSk7XG5cdH1cbn1cbiJdfQ==